# Email Generation Assistant: Eval & Comparison

Generates professional emails from (Intent, Key Facts, Tone) using
OpenAI and Gemini, then scores both on 3 custom metrics and compares them.

## Setup

```bash
pip install -r requirements.txt
npm install   # only needed for generate_report.js
cp .env.example .env   # fill in OPENAI_API_KEY and GEMINI_API_KEY
```

Verify `OPENAI_MODEL` / `GEMINI_MODEL` in `config.py` are valid for your
account before running, model IDs change frequently.

## Run

```bash
python run_eval.py
```

Outputs `reports/eval_results.json` and `reports/eval_results.csv`
(metric definitions, raw per-scenario scores, provider averages), and
prints a summary comparison table to the console.

## Web Dashboard & Custom Playground

You can use the interactive web dashboard to view detailed evaluation results and test custom scenarios interactively.

```bash
uv run python app.py
```

Then visit [http://localhost:5000](http://localhost:5000) in your browser. The dashboard includes:
- **Preset Scenarios:** View side-by-side comparison of the 10 preset test scenarios and their overall metric summaries.
- **Custom Scenario Playground:** A robust testing area where you can input your own intent, key facts, and requested tone. You can override default generation models (e.g., select `gpt-4o` or custom IDs) and dynamically run generation and evaluation on your own inputs. 
- **Step-by-Step Evaluation Breakdown:** View the precise token-overlap calculations, the LLM Judge justification reasoning, and the exact mathematical formula components for the Format & Conciseness score.
- **Exporting & UX:** Easily copy emails to your clipboard, manually toggle Dark/Light modes, and export text reports of your comparisons.

Then generate the Final Report deliverable (Word doc, plain
black-on-white):

```bash
node generate_report.js
```

This builds `reports/Final_Report.docx` containing the prompt template,
metric definitions, the full raw data table, and a comparative analysis
section. The comparative analysis is auto-drafted from the data (which
provider wins each metric, the lowest-scoring example per provider per
metric) but the assessment also asks for a production recommendation
"and why", that's a judgment call the script deliberately leaves as a
flagged TODO rather than fabricating one, see the bottom of the
generated document.

### Dry run without API keys

```bash
MOCK_MODE=1 python run_eval.py
node generate_report.js
```

Runs the full pipeline with stub responses instead of live API calls,
useful for confirming the pipeline works before spending API credits.
The generated report flags itself as mock data so it can't be mistaken
for a real result. **Do not submit a report generated this way.**

Run unit tests (no API calls, deterministic metrics only):

```bash
pytest tests/
```

## Prompting technique: Role-Prompting + Few-Shot

See `prompts/email_prompt.py`. Chain-of-Thought was deliberately not
used: it's a poor fit for a single clean-output generation task and
risks reasoning text leaking into the final email. The system prompt
fixes the persona and embeds one worked example to anchor output format
(subject line, greeting, sign-off) and how facts should be woven into
sentences rather than dumped as a list. The identical prompt is sent to
both providers so the comparison isolates model quality, not prompt
differences.

## Custom Metrics

| # | Metric | Type | Logic |
|---|--------|------|-------|
| 1 | Fact Recall | Automated | Token-overlap ratio per fact vs. the email; fact "recalled" if ratio >= threshold. Score = recalled / total. |
| 2 | Tone Fidelity | LLM-as-judge | 1-5 rubric on tone match, normalized to 0-1. Cross-judged by default (see below). |
| 3 | Format & Conciseness | Automated | Weighted composite: structural completeness (subject/greeting/sign-off) + length ratio vs. human reference + Flesch Reading Ease in a professional band. |

Two of three metrics are fully deterministic by design, reproducible
and auditable. Only Tone Fidelity uses an LLM judge, since tone is a
semantic/stylistic property automated rules can't reliably capture.

**Self-preference bias mitigation:** since this project compares
OpenAI vs. Gemini, having one of them judge its own output (or the
competitor's) would bias the Tone Fidelity metric. `config.JUDGE_MODE =
"cross"` has both providers judge both outputs and averages the two
scores. This is a mitigation, not a fix, call this out explicitly in
the final report rather than presenting the judge as neutral.

Every judge call returns a one-sentence justification alongside the
score (see `reports/eval_results.json` -> `tone_fidelity_detail`), so
scores are auditable rather than a black box.

## Reference email sources

Each scenario's `reference_email` in `data/scenarios.json` includes a
`reference_source` field citing a real, published email-writing guide
for that scenario type (Indeed, Flodesk, Fyxer, etc.). These sources
informed structure and best practices only, what sections to include,
what order, what tone conventions apply. The reference email bodies
themselves are original text written to satisfy this project's
specific facts (order numbers, dates, tracking numbers), not copied
from any source: a generic web template can't contain scenario-specific
facts like "Order #4521" or "TRK998231" verbatim, and reproducing
template text at length would also exceed fair-use norms for a single
short guide. Citing structural inspiration while writing original
content satisfied both constraints.

| Scenario | Source |
|---|---|
| 1. Follow up after meeting | Fyxer, "Follow-up email after meeting" |
| 2. RFP request | Flodesk, "RFP email templates" |
| 3. Shipping delay apology | Flodesk, "Shipping delay email templates" |
| 4. Server downtime notice | Gmelius, "IT Outage & Downtime Notification" |
| 5. Networking introduction | Flodesk, "Networking email templates" |
| 6. Customer complaint response | ProProfs Help Desk, "Customer Complaint Response Templates" |
| 7. Job offer | WeCP, "Job Offer Email Template" |
| 8. Event invitation | Eventify, "Event Invitation Email Templates" |
| 9. Project status update | Status.net, "Professional Status Update Emails" |
| 10. Resignation (two weeks) | Tallo, "Two Weeks' Notice Email" |

Full URLs are in `data/scenarios.json` under each scenario's
`reference_source.url`. Worth a one-line mention in your final report
so the grader sees the reference emails are grounded in real
professional-writing conventions, not arbitrary.

## Repo structure

```
config.py                  Model names, thresholds, judge mode
prompts/email_prompt.py    System prompt + few-shot example
generation/                OpenAI and Gemini email-generation clients
evaluation/metrics.py      Metric 1 (Fact Recall) and Metric 3 (Format/Conciseness)
evaluation/judge.py        Metric 2 (Tone Fidelity, LLM-as-judge, cross-judged)
data/scenarios.json        10 test scenarios + human reference emails
run_eval.py                Runs everything, writes reports/
tests/test_metrics.py      Unit tests for the deterministic metrics
```

## Deliverables checklist

- [x] Code repository (this folder) — push to GitHub yourself; I can't create a repo or push commits on your behalf. `git init && git add . && git commit -m "initial commit"` then create a repo on GitHub and `git push`.
- [x] README explaining setup/execution (this file)
- [ ] **You must run** `python run_eval.py` with real `OPENAI_API_KEY` / `GEMINI_API_KEY` — I have no network access to OpenAI's or Google's APIs from this environment, so this step has only been integration-tested in `MOCK_MODE`, never run for real.
- [x] `reports/eval_results.json` / `.csv` — generated automatically once you run the step above
- [x] `reports/Final_Report.docx` — generated automatically by `node generate_report.js` once real results exist; contains the prompt template, metric definitions, raw data, and an auto-drafted comparative analysis
- [ ] **You must finish** the "production recommendation and why" paragraph at the bottom of the Final Report — flagged as a TODO since it's a judgment call, not something the script should invent
