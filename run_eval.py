"""
Runs all 10 scenarios through both providers, scores each output on the
3 custom metrics, and writes a structured report (CSV + JSON) to
reports/. Run with: python run_eval.py
"""

import json
import csv
from pathlib import Path
from datetime import datetime, timezone

import config
from generation import openai_client, gemini_client
from evaluation.metrics import fact_recall_score, format_conciseness_score
from evaluation.judge import tone_fidelity_score

METRIC_DEFINITIONS = {
    "fact_recall": (
        "Fraction of Key Facts whose tokens appear (>= "
        f"{config.FACT_RECALL_MATCH_THRESHOLD} overlap ratio) in the "
        "generated email. Deterministic, automated."
    ),
    "tone_fidelity": (
        "LLM-as-judge rubric (1-5, normalized to 0-1) rating how well "
        f"word choice and structure match the requested tone. "
        f"Judge mode: {config.JUDGE_MODE}."
    ),
    "format_conciseness": (
        "Composite of structural completeness (subject/greeting/sign-off), "
        "length ratio vs. the human reference, and Flesch Reading Ease "
        "landing in a professional band. Weights in config.FORMAT_WEIGHTS."
    ),
}

GENERATORS = {
    "openai": openai_client.generate_email,
    "gemini": gemini_client.generate_email,
}


def load_scenarios() -> list[dict]:
    path = Path(__file__).parent / "data" / "scenarios.json"
    return json.loads(path.read_text())


def run() -> list[dict]:
    scenarios = load_scenarios()
    rows = []

    for scenario in scenarios:
        for provider, generate_fn in GENERATORS.items():
            print(f"[scenario {scenario['id']}] generating with {provider}...")
            email_text = generate_fn(
                scenario["intent"], scenario["key_facts"], scenario["tone"]
            )

            fact = fact_recall_score(scenario["key_facts"], email_text)
            fmt = format_conciseness_score(email_text, scenario["reference_email"])
            tone = tone_fidelity_score(scenario["tone"], email_text)

            rows.append({
                "scenario_id": scenario["id"],
                "intent": scenario["intent"],
                "tone_requested": scenario["tone"],
                "provider": provider,
                "generated_email": email_text,
                "fact_recall_score": fact["score"],
                "tone_fidelity_score": tone["score"],
                "format_conciseness_score": fmt["score"],
                "fact_recall_detail": fact["details"],
                "tone_fidelity_detail": tone["judgments"],
                "format_conciseness_detail": {
                    k: v for k, v in fmt.items() if k != "score"
                },
            })

    return rows


def write_reports(rows: list[dict]) -> None:
    reports_dir = Path(__file__).parent / "reports"
    reports_dir.mkdir(exist_ok=True)

    averages = {}
    for provider in config.PROVIDERS:
        provider_rows = [r for r in rows if r["provider"] == provider]
        n = len(provider_rows) or 1
        averages[provider] = {
            "fact_recall_score": round(sum(r["fact_recall_score"] for r in provider_rows) / n, 3),
            "tone_fidelity_score": round(sum(r["tone_fidelity_score"] for r in provider_rows) / n, 3),
            "format_conciseness_score": round(sum(r["format_conciseness_score"] for r in provider_rows) / n, 3),
        }

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "metric_definitions": METRIC_DEFINITIONS,
        "raw_results": rows,
        "provider_averages": averages,
    }

    json_path = reports_dir / "eval_results.json"
    json_path.write_text(json.dumps(report, indent=2))

    csv_path = reports_dir / "eval_results.csv"
    csv_fields = [
        "scenario_id", "intent", "tone_requested", "provider",
        "fact_recall_score", "tone_fidelity_score", "format_conciseness_score",
    ]
    with csv_path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=csv_fields)
        writer.writeheader()
        for r in rows:
            writer.writerow({k: r[k] for k in csv_fields})

    print(f"\nWrote {json_path} and {csv_path}")
    print_summary(averages)


def print_summary(averages: dict) -> None:
    print("\n=== Provider Averages ===")
    metrics = ["fact_recall_score", "tone_fidelity_score", "format_conciseness_score"]
    header = f"{'metric':<28}" + "".join(f"{p:>12}" for p in config.PROVIDERS)
    print(header)
    for m in metrics:
        row = f"{m:<28}" + "".join(f"{averages[p][m]:>12}" for p in config.PROVIDERS)
        print(row)

    for m in metrics:
        best = max(config.PROVIDERS, key=lambda p: averages[p][m])
        print(f"-> {best} scored higher on {m}")


if __name__ == "__main__":
    results = run()
    write_reports(results)
