"""
Prompting technique used: Role-Prompting + Few-Shot Example.

Why this combination over alternatives:
- Chain-of-Thought is a poor fit here: we want a clean final email, not
  visible reasoning, and exposing reasoning risks it leaking into the
  output ("Step 1: I will now...").
- Few-shot alone under-constrains tone calibration.
- Role-prompting fixes the persona/register; the embedded few-shot
  example fixes output *format* (subject line, greeting, sign-off) and
  demonstrates how Facts get woven in rather than listed verbatim.

The same system/user text is sent to both OpenAI and Gemini so the
comparison isolates model quality, not prompt differences.

SYSTEM_PROMPT lives in system_prompt.txt (not inline) so both this
module and generate_report.js read the exact same text, single source
of truth for the "Prompt Template Used" section of the final report.
"""

from pathlib import Path

SYSTEM_PROMPT = (Path(__file__).parent / "system_prompt.txt").read_text()


def build_user_prompt(intent: str, key_facts: list[str], tone: str) -> str:
    facts_block = "\n".join(f"- {fact}" for fact in key_facts)
    return (
        f"Intent: {intent}\n"
        f"Key Facts:\n{facts_block}\n"
        f"Tone: {tone}"
    )
