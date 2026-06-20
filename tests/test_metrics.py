import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from evaluation.metrics import fact_recall_score, format_conciseness_score


def test_fact_recall_full_match():
    facts = ["The meeting is on Tuesday"]
    email = "Subject: Reminder\n\nHi, just confirming the meeting is on Tuesday.\n\nBest,\nA"
    result = fact_recall_score(facts, email)
    assert result["score"] == 1.0


def test_fact_recall_no_match():
    facts = ["The server crashed at midnight due to a power outage"]
    email = "Subject: Hello\n\nHope you're doing well.\n\nBest,\nA"
    result = fact_recall_score(facts, email)
    assert result["score"] == 0.0


def test_fact_recall_empty_facts():
    result = fact_recall_score([], "Subject: Hi\n\nHello.\n\nBest,\nA")
    assert result["score"] == 0.0
    assert result["details"] == []


def test_format_conciseness_well_formed_email_scores_high():
    reference = "Subject: Test\n\nHi there,\n\nThis is a short professional message with a few words in it.\n\nBest regards,\nA"
    candidate = "Subject: Test\n\nHello,\n\nThis is also a short professional message with several words.\n\nRegards,\nB"
    result = format_conciseness_score(candidate, reference)
    assert result["score"] > 0.7


def test_format_conciseness_missing_structure_scores_lower():
    reference = "Subject: Test\n\nHi there,\n\nThis is a short professional message.\n\nBest regards,\nA"
    candidate = "just some text with no subject no greeting and no signoff at all"
    result = format_conciseness_score(candidate, reference)
    assert result["structure_score"] == 0.0
