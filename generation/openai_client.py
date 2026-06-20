"""Email generation via OpenAI's Chat Completions API."""

from openai import OpenAI

import config
from prompts.email_prompt import SYSTEM_PROMPT, build_user_prompt
from utils import with_retries

_client = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=config.OPENAI_API_KEY)
    return _client


def _mock_email(intent: str, key_facts: list[str], tone: str) -> str:
    facts_sentence = " ".join(key_facts)
    return (
        "Subject: " + intent + "\n\n"
        "Hi there,\n\n"
        f"[MOCK-OPENAI] Writing regarding: {intent}. {facts_sentence} "
        f"This message is written in a {tone} tone.\n\n"
        "Best regards,\nOmar"
    )


@with_retries
def _call_api(user_prompt: str, model: str = None) -> str:
    client = _get_client()
    response = client.chat.completions.create(
        model=model or config.OPENAI_MODEL,
        temperature=config.GENERATION_TEMPERATURE,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )
    return response.choices[0].message.content.strip()


def generate_email(intent: str, key_facts: list[str], tone: str, model: str = None) -> str:
    if config.MOCK_MODE:
        return _mock_email(intent, key_facts, tone)
    user_prompt = build_user_prompt(intent, key_facts, tone)
    return _call_api(user_prompt, model)

