# Email Generation Assistant: Evaluation & Comparison

An AI-powered Email Generation Assistant built to compare the performance of OpenAI and Google Gemini models. The assistant generates professional emails based on three distinct inputs: **Intent**, **Key Facts**, and **Tone**. It then evaluates the generated emails against a custom-built evaluation framework.

## Project Objective

The primary objective of this project is to implement an LLM-based email generator and a robust evaluation strategy to objectively compare model performance. The system uses advanced prompt engineering and specific custom metrics to assess quality, format, and accuracy.

## Core Technical Features

### 1. Advanced Prompt Engineering
The system utilizes a **Role-Playing + Few-Shot** prompting technique (see `prompts/email_prompt.py`). Chain-of-Thought was intentionally avoided to prevent reasoning traces from leaking into the final email output. The system prompt anchors the model to a professional persona and provides a structured example demonstrating how facts should be seamlessly woven into sentences rather than dumped as a list. Both providers receive identical prompts to ensure an unbiased comparison.

### 2. Custom Evaluation Metrics
Three custom metrics were designed to objectively evaluate email generation quality:

| Metric | Type | Description / Logic |
|---|---|---|
| **1. Fact Recall** | Automated | Calculates the token-overlap ratio per required fact against the generated email. A fact is considered "recalled" if the overlap exceeds a defined threshold. Score = Recalled Facts / Total Facts. |
| **2. Tone Fidelity** | LLM-as-Judge | Evaluates how well the email matches the requested tone using a 1-5 rubric (normalized to 0-1). *Note: To mitigate self-preference bias, a cross-judge approach is used where both providers judge both outputs, and the scores are averaged.* |
| **3. Format & Conciseness** | Automated | A weighted composite score based on structural completeness (inclusion of subject, greeting, sign-off), length ratio compared to a human reference, and Flesch Reading Ease score within a professional band. |

### 3. Web Dashboard & Custom Scenario Playground
An interactive web interface is provided to visualize the evaluation results and test new scenarios on the fly.

## Model Comparison & Analysis
A comprehensive, data-driven analysis of the two models' performance (OpenAI vs. Gemini) based on the test runs can be found in [comparative_analysis.md](comparative_analysis.md). This includes the determination of the winning model, an analysis of the lower-performing model's primary failure mode, and a production recommendation.

## Setup and Installation

### Prerequisites
- Python 3.9+
- Node.js (for report generation)
- API Keys for OpenAI and Gemini

### Installation
1. Clone the repository:
   ```bash
   git clone <repository_url>
   cd email-eval-assistant
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Install Node.js dependencies (required for report generation):
   ```bash
   npm install
   ```
4. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Add your `OPENAI_API_KEY` and `GEMINI_API_KEY` to the `.env` file.

*Note: Verify that `OPENAI_MODEL` and `GEMINI_MODEL` in `config.py` are valid for your accounts, as model availability may change.*

## Usage

### CLI Evaluation (Batch Processing)
Run the full evaluation suite across the 10 preset scenarios:
```bash
python run_eval.py
```
This generates `reports/eval_results.json` and `reports/eval_results.csv` containing raw scores, metric definitions, and provider averages. It also outputs a comparison table to the console.

### Generating the Final Report
After running the evaluation, you can generate a structured deliverable report (Word doc):
```bash
node generate_report.js
```
This outputs `reports/Final_Report.docx` containing the prompt template, metric definitions, raw data table, and an auto-drafted comparative analysis.

### Interactive Web Dashboard
Start the local server to access the Custom Scenario Playground and visual comparison tool:
```bash
python app.py
```
Visit `http://localhost:5000` to view preset side-by-side comparisons, run custom inputs (Intent, Facts, Tone) against specific models, and view step-by-step evaluation logic breakdowns.

### Testing & Mock Mode
To run the pipeline without consuming API credits:
```bash
MOCK_MODE=1 python run_eval.py
```
To run deterministic unit tests:
```bash
pytest tests/
```

## Repository Structure
```
config.py                  Configuration, model names, and judge settings
prompts/email_prompt.py    System prompt and few-shot examples
generation/                OpenAI and Gemini API clients
evaluation/metrics.py      Deterministic metrics (Fact Recall, Format/Conciseness)
evaluation/judge.py        LLM-as-judge metric (Tone Fidelity)
data/scenarios.json        Test scenarios and human reference emails
app.py                     Flask backend for the Web Dashboard
static/                    Frontend assets (HTML, CSS, JS) for the Dashboard
run_eval.py                CLI script for batch evaluation
generate_report.js         Node.js script to generate DOCX report
tests/test_metrics.py      Unit tests
```

## Reference Email Sources
The `reference_email` fields in `data/scenarios.json` are grounded in published professional writing guides (e.g., Flodesk, Gmelius, Fyxer). While the specific text was written originally to fit this project's unique facts, the structural best practices mirror industry standards.
