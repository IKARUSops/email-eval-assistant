"""
Minimal Flask API for the Email Eval Assistant.
Provides endpoints for generating emails and viewing results.

Run with: python app.py
Then visit: http://localhost:5000
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from pathlib import Path
import json

import config
from generation import openai_client, gemini_client
from evaluation.metrics import fact_recall_score, format_conciseness_score
from evaluation.judge import tone_fidelity_score
from prompts.email_prompt import build_user_prompt

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

GENERATORS = {
    "openai": openai_client.generate_email,
    "gemini": gemini_client.generate_email,
}


def load_scenarios() -> list[dict]:
    """Load test scenarios from data/scenarios.json"""
    path = Path(__file__).parent / "data" / "scenarios.json"
    return json.loads(path.read_text())


@app.route("/", methods=["GET"])
def index():
    """Serve the dashboard"""
    return send_from_directory("static", "index.html")


@app.route("/api/scenarios", methods=["GET"])
def get_scenarios():
    """Get all 10 test scenarios"""
    scenarios = load_scenarios()
    return jsonify(scenarios)


@app.route("/api/generate", methods=["POST"])
def generate():
    """Generate an email for a given scenario and provider"""
    data = request.json
    scenario_id = data.get("scenario_id")
    provider = data.get("provider")  # "openai" or "gemini"
    model = data.get("model")  # Optional model override

    if provider not in GENERATORS:
        return jsonify({"error": f"Unknown provider: {provider}"}), 400

    if not scenario_id or str(scenario_id).startswith("custom"):
        intent = data.get("intent")
        key_facts = data.get("key_facts")
        tone = data.get("tone")
        if not intent or not key_facts or not tone:
            return jsonify({"error": "Missing intent, key_facts, or tone for custom generation"}), 400
        if isinstance(key_facts, str):
            key_facts = [f.strip() for f in key_facts.split("\n") if f.strip()]
    else:
        scenarios = load_scenarios()
        scenario = next((s for s in scenarios if s["id"] == scenario_id), None)
        if not scenario:
            return jsonify({"error": f"Scenario {scenario_id} not found"}), 404
        intent = scenario["intent"]
        key_facts = scenario["key_facts"]
        tone = scenario["tone"]

    try:
        email_text = GENERATORS[provider](
            intent,
            key_facts,
            tone,
            model=model
        )
        return jsonify({
            "scenario_id": scenario_id or "custom",
            "provider": provider,
            "generated_email": email_text,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/evaluate", methods=["POST"])
def evaluate():
    """Evaluate a generated email on all 3 metrics"""
    data = request.json
    scenario_id = data.get("scenario_id")
    email_text = data.get("email_text")

    if not scenario_id or str(scenario_id).startswith("custom"):
        key_facts = data.get("key_facts")
        reference_email = data.get("reference_email", "")
        tone = data.get("tone")
        if not key_facts or not tone:
            return jsonify({"error": "Missing key_facts or tone for custom evaluation"}), 400
        if isinstance(key_facts, str):
            key_facts = [f.strip() for f in key_facts.split("\n") if f.strip()]
    else:
        scenarios = load_scenarios()
        scenario = next((s for s in scenarios if s["id"] == scenario_id), None)
        if not scenario:
            return jsonify({"error": f"Scenario {scenario_id} not found"}), 404
        key_facts = scenario["key_facts"]
        reference_email = scenario["reference_email"]
        tone = scenario["tone"]

    try:
        fact = fact_recall_score(key_facts, email_text)
        fmt = format_conciseness_score(email_text, reference_email)
        tone_score = tone_fidelity_score(tone, email_text)

        return jsonify({
            "scenario_id": scenario_id or "custom",
            "fact_recall": fact,
            "format_conciseness": fmt,
            "tone_fidelity": tone_score,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/results", methods=["GET"])
def get_results():
    """Load cached results from reports/eval_results.json if it exists"""
    results_path = Path(__file__).parent / "reports" / "eval_results.json"
    if results_path.exists():
        return jsonify(json.loads(results_path.read_text()))
    return jsonify({"raw_results": [], "provider_averages": {}}), 200


if __name__ == "__main__":
    app.run(debug=True, port=5000, use_reloader=False, use_debugger=False)
