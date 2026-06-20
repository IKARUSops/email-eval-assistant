"""Email generation via Google's Gemini API (google-genai SDK)."""

from google import genai
from google.genai import types

import config
from prompts.email_prompt import SYSTEM_PROMPT, build_user_prompt
from utils import with_retries

_client = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=config.GEMINI_API_KEY)
    return _client


def _mock_email(intent: str, key_facts: list[str], tone: str) -> str:
    facts_sentence = " ".join(key_facts)
    return (
        "Subject: " + intent + "\n\n"
        "Hello,\n\n"
        f"[MOCK-GEMINI] Re: {intent}. {facts_sentence} "
        f"Tone requested: {tone}.\n\n"
        "Regards,\nOmar"
    )


@with_retries
def _call_api(user_prompt: str, model: str = None) -> str:
    client = _get_client()
    response = client.models.generate_content(
        model=model or config.GEMINI_MODEL,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=config.GENERATION_TEMPERATURE,
        ),
    )
    return response.text.strip()


def generate_email(intent: str, key_facts: list[str], tone: str, model: str = None) -> str:
    if config.MOCK_MODE:
        return _mock_email(intent, key_facts, tone)
    user_prompt = build_user_prompt(intent, key_facts, tone)
    return _call_api(user_prompt, model)

