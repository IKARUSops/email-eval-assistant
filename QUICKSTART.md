# Quick Start: Web Dashboard

## What's New?

You now have a **modern web dashboard** to visualize and interact with the email evaluation system.

## Install

```bash
pip install flask flask-cors
# or
pip install .
```

## Run

### Option 1: With Real Results (requires API keys)
```bash
# Generate evaluation data (takes 2-3 minutes)
python run_eval.py

# Start web server
python app.py

# Visit: http://localhost:5000
```

### Option 2: With Mock Data (no API keys)
```bash
MOCK_MODE=1 python run_eval.py
python app.py
# Visit: http://localhost:5000
```

## What You'll See

**Performance Summary**
- Which model (OpenAI/Gemini) won each metric
- Average scores across all 10 scenarios

**Scenario Browser**
- 10 clickable cards showing intent + tone
- Click to open detailed comparison

**Detailed View**
- 📋 Left: Scenario details & reference email
- 🤖 Middle: Generate emails for each model (side-by-side)
- 📊 Right: See 3 metric scores instantly
- 🔍 Below: Detailed breakdown of results

**3 Metrics Shown:**
1. ✅ **Fact Recall** — Did the AI include all the facts? (automated)
2. 🧠 **Tone Fidelity** — How well did it match the tone? (LLM judge)
3. 📏 **Format & Conciseness** — Structure, length, readability (automated)

## Design

- **Minimalistic** — clean, spacious, no clutter
- **Modern** — dark mode, responsive, smooth animations
- **Simple** — vanilla HTML/CSS/JS, no frameworks
- **Mobile-friendly** — works on phone/tablet/desktop

## Files Added

```
app.py                    ← Flask API server
static/
  ├── index.html         ← Dashboard HTML
  ├── style.css          ← Modern styling
  └── app.js             ← Client interactions
UI_ADDITIONS.md           ← Full documentation
```

## API Endpoints

Used by the dashboard (can also be called directly):

```
GET  /api/scenarios           → List all 10 scenarios
POST /api/generate            → Generate email (provider + scenario)
POST /api/evaluate            → Score email on 3 metrics
GET  /api/results             → Cached results from eval_results.json
GET  /                        → Dashboard HTML
```

## Example: Using the API

```bash
# Get all scenarios
curl http://localhost:5000/api/scenarios

# Generate an email
curl -X POST http://localhost:5000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"scenario_id": 1, "provider": "openai"}'

# Evaluate an email
curl -X POST http://localhost:5000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{"scenario_id": 1, "email_text": "Your email here..."}'
```

## Troubleshooting

**Port 5000 already in use?**
```bash
python app.py --port 8000
# Visit: http://localhost:8000
```

**Import error (flask not found)?**
```bash
pip install flask flask-cors
```

**No results showing in summary?**
```bash
# Run evaluation first:
python run_eval.py
# Then refresh browser
```

**Want mock data quickly?**
```bash
MOCK_MODE=1 python run_eval.py
python app.py
```

---

See `UI_ADDITIONS.md` for full documentation.
