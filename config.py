"""
Central config. Verify model IDs against your own OpenAI / Gemini
console before running — these change often and may be outdated.
"""

import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Verify these are still valid/available on your account.
OPENAI_MODEL = "gpt-4o-mini"
GEMINI_MODEL = "gemini-3.1-flash-lite"

# Generation settings
GENERATION_TEMPERATURE = 0.7

# Judge settings (LLM-as-judge calls should be near-deterministic)
JUDGE_TEMPERATURE = 0.0
# "cross" = average of OpenAI-as-judge and Gemini-as-judge (mitigates
# self-preference bias). "single" = use JUDGE_SINGLE_PROVIDER only.
JUDGE_MODE = "cross"
JUDGE_SINGLE_PROVIDER = "openai"

# Metric 1: Fact Recall
FACT_RECALL_MATCH_THRESHOLD = 0.6  # token-overlap ratio to count a fact as "recalled"

# Metric 3: Format & Conciseness — Flesch Reading Ease target band for
# professional business correspondence.
READABILITY_TARGET_MIN = 45
READABILITY_TARGET_MAX = 70

# Metric weighting for Metric 3 composite (must sum to 1.0)
FORMAT_WEIGHTS = {
    "structure": 0.4,
    "length_ratio": 0.3,
    "readability": 0.3,
}

PROVIDERS = ["openai", "gemini"]

# When MOCK_MODE=1, generation/judge clients return deterministic stub
# data instead of calling real APIs. Used to integration-test the full
# pipeline (run_eval.py -> reports -> generate_report.js) without
# spending API credits or needing keys. Real runs must have this unset.
MOCK_MODE = os.getenv("MOCK_MODE", "0") == "1"

# Retry settings for live API calls
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2
