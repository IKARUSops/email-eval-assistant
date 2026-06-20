"""
Custom Metric 2: Tone Fidelity Score (LLM-as-judge)

Design note on bias: if Provider A's output is judged only by Provider
A, the score is contaminated by self-preference bias (a well-documented
LLM-as-judge failure mode). Since this project compares OpenAI vs.
Gemini, JUDGE_MODE="cross" has BOTH providers judge BOTH outputs and
averages the two scores per email. This doesn't eliminate bias but
roughly cancels it out, and is the strategy used by default
(config.JUDGE_MODE). Document this tradeoff in your report — flagging
it is worth more credit than pretending the judge is neutral.

Every judge call returns a justification, not just a number, so scores
stay auditable rather than being an opaque black box.
"""

import json

import config
from generation.openai_client import _get_client as _get_openai_client
from generation.gemini_client import _get_client as _get_gemini_client
from utils import with_retries
from google.genai import types as genai_types

_JUDGE_SYSTEM_PROMPT = """You are an impartial evaluator of email tone. \
You will be given a Target Tone and an Email. Rate, on a 1-5 integer \
scale, how well the email's word choice, sentence structure, and \
register match the Target Tone (5 = perfect match, 1 = completely \
mismatched). Respond ONLY with JSON matching this schema:
{"score": <integer 1-5>, "justification": "<one sentence>"}"""

_JSON_SCHEMA = {
    "name": "tone_judgment",
    "schema": {
        "type": "object",
        "properties": {
            "score": {"type": "integer", "minimum": 1, "maximum": 5},
            "justification": {"type": "string"},
        },
        "required": ["score", "justification"],
        "additionalProperties": False,
    },
}


def _judge_prompt(target_tone: str, email_text: str) -> str:
    return f"Target Tone: {target_tone}\n\nEmail:\n{email_text}"


def _mock_judgment(target_tone: str, email_text: str, judge_name: str) -> dict:
    # Deterministic-ish mock: reward emails that actually mention the tone word.
    score = 4 if target_tone.split()[0].lower() in email_text.lower() else 3
    return {"score": score, "justification": f"[MOCK-{judge_name.upper()}] heuristic tone check"}


@with_retries
def _judge_with_openai(target_tone: str, email_text: str) -> dict:
    if config.MOCK_MODE:
        return _mock_judgment(target_tone, email_text, "openai")
    client = _get_openai_client()
    response = client.chat.completions.create(
        model=config.OPENAI_MODEL,
        temperature=config.JUDGE_TEMPERATURE,
        messages=[
            {"role": "system", "content": _JUDGE_SYSTEM_PROMPT},
            {"role": "user", "content": _judge_prompt(target_tone, email_text)},
        ],
        response_format={"type": "json_schema", "json_schema": _JSON_SCHEMA},
    )
    return json.loads(response.choices[0].message.content)


@with_retries
def _judge_with_gemini(target_tone: str, email_text: str) -> dict:
    if config.MOCK_MODE:
        return _mock_judgment(target_tone, email_text, "gemini")
    client = _get_gemini_client()
    response = client.models.generate_content(
        model=config.GEMINI_MODEL,
        contents=_judge_prompt(target_tone, email_text),
        config=genai_types.GenerateContentConfig(
            system_instruction=_JUDGE_SYSTEM_PROMPT,
            temperature=config.JUDGE_TEMPERATURE,
            response_mime_type="application/json",
        ),
    )
    return json.loads(response.text)


def tone_fidelity_score(target_tone: str, email_text: str) -> dict:
    if config.JUDGE_MODE == "single":
        judge_fn = _judge_with_openai if config.JUDGE_SINGLE_PROVIDER == "openai" else _judge_with_gemini
        result = judge_fn(target_tone, email_text)
        return {
            "score": round(result["score"] / 5.0, 3),
            "judgments": [{"judge": config.JUDGE_SINGLE_PROVIDER, **result}],
        }

    # cross mode: average both judges
    openai_result = _judge_with_openai(target_tone, email_text)
    gemini_result = _judge_with_gemini(target_tone, email_text)
    avg = (openai_result["score"] + gemini_result["score"]) / 2.0

    return {
        "score": round(avg / 5.0, 3),
        "judgments": [
            {"judge": "openai", **openai_result},
            {"judge": "gemini", **gemini_result},
        ],
    }
