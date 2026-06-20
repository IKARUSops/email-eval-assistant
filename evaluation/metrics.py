"""
Custom Metric 1: Fact Recall Score
Custom Metric 3: Format & Conciseness Score

Both are fully deterministic (no LLM call) by design — they should be
the reliable, reproducible backbone of the eval, in contrast to Metric 2
(Tone Fidelity), which necessarily relies on an LLM judge since tone is
a semantic/stylistic property that rule-based methods can't capture well.
"""

import re
import textstat

import config

_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "to",
    "of", "in", "on", "at", "for", "and", "or", "with", "by", "as",
    "that", "this", "it", "its", "will", "have", "has", "had", "we",
    "our", "you", "your", "i", "their", "they", "from", "please",
}


def _tokenize(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return {w for w in words if w not in _STOPWORDS}


def fact_recall_score(key_facts: list[str], generated_email: str) -> dict:
    """
    For each fact, compute token-overlap ratio between the fact and the
    email. A fact counts as 'recalled' if the ratio meets
    config.FACT_RECALL_MATCH_THRESHOLD. Score = recalled / total.

    Returns per-fact detail so the result stays explainable/auditable,
    not just a single opaque number.
    """
    email_tokens = _tokenize(generated_email)
    details = []

    for fact in key_facts:
        fact_tokens = _tokenize(fact)
        if not fact_tokens:
            continue
        overlap = len(fact_tokens & email_tokens) / len(fact_tokens)
        recalled = overlap >= config.FACT_RECALL_MATCH_THRESHOLD
        details.append({
            "fact": fact,
            "overlap_ratio": round(overlap, 3),
            "recalled": recalled,
        })

    if not details:
        return {"score": 0.0, "details": []}

    score = sum(d["recalled"] for d in details) / len(details)
    return {"score": round(score, 3), "details": details}


def _structure_score(email_text: str) -> float:
    lower = email_text.lower()
    has_subject = bool(re.search(r"^\s*subject\s*:", email_text, re.IGNORECASE | re.MULTILINE))
    has_greeting = bool(re.search(r"\b(hi|hello|dear|good morning|good afternoon)\b", lower))
    has_signoff = bool(re.search(r"\b(regards|sincerely|best|thanks|thank you|cheers)\b", lower))
    return sum([has_subject, has_greeting, has_signoff]) / 3.0


def _length_ratio_score(generated_email: str, reference_email: str) -> float:
    gen_words = len(generated_email.split())
    ref_words = len(reference_email.split())
    if ref_words == 0:
        return 0.0
    deviation = abs(gen_words - ref_words) / ref_words
    return max(0.0, 1.0 - min(deviation, 1.0))


def _readability_score(email_text: str) -> float:
    try:
        flesch = textstat.flesch_reading_ease(email_text)
    except Exception:
        return 0.5  # neutral fallback if textstat can't score very short text

    lo, hi = config.READABILITY_TARGET_MIN, config.READABILITY_TARGET_MAX
    if lo <= flesch <= hi:
        return 1.0
    distance = (lo - flesch) if flesch < lo else (flesch - hi)
    band_width = hi - lo
    return max(0.0, 1.0 - distance / band_width)


def format_conciseness_score(generated_email: str, reference_email: str) -> dict:
    """
    Composite of three sub-scores: structural completeness (subject/
    greeting/sign-off present), length ratio vs. the human reference
    (proxy for conciseness), and Flesch Reading Ease landing in a
    professional-writing band. Weights are configurable in config.py.
    """
    structure = _structure_score(generated_email)
    length_ratio = _length_ratio_score(generated_email, reference_email)
    readability = _readability_score(generated_email)

    w = config.FORMAT_WEIGHTS
    composite = (
        structure * w["structure"]
        + length_ratio * w["length_ratio"]
        + readability * w["readability"]
    )

    return {
        "score": round(composite, 3),
        "structure_score": round(structure, 3),
        "length_ratio_score": round(length_ratio, 3),
        "readability_score": round(readability, 3),
    }
