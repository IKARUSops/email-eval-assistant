/**
 * Generates reports/Final_Report.docx from reports/eval_results.json.
 *
 * Run AFTER `python run_eval.py` has produced real (non-mock) results:
 *   node generate_report.js
 *
 * Builds the 4 sections required by the assessment's "Final Report"
 * deliverable: Prompt Template Used, Custom Metric Definitions & Logic,
 * Raw Evaluation Data, and Comparative Analysis. The Comparative
 * Analysis section is auto-drafted from the data (which provider wins
 * each metric, lowest-scoring example per provider) but still needs a
 * human pass: the assessment asks for a "recommendation... and why",
 * which is a judgment call this script flags rather than invents.
 */

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, BorderStyle, WidthType, AlignmentType,
} = require("docx");

const RESULTS_PATH = path.join(__dirname, "reports", "eval_results.json");
const PROMPT_PATH = path.join(__dirname, "prompts", "system_prompt.txt");
const OUT_PATH = path.join(__dirname, "reports", "Final_Report.docx");

if (!fs.existsSync(RESULTS_PATH)) {
  console.error(`Missing ${RESULTS_PATH}. Run "python run_eval.py" first.`);
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf-8"));
const systemPrompt = fs.readFileSync(PROMPT_PATH, "utf-8");
const isMockData = results.raw_results.some(r => r.generated_email.includes("[MOCK-"));

const border = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

function cell(text, widthDXA, opts = {}) {
  return new TableCell({
    borders,
    width: { size: widthDXA, type: WidthType.DXA },
    margins: cellMargins,
    children: [new Paragraph({
      children: [new TextRun({ text: String(text), bold: !!opts.bold, size: 18 })],
    })],
  });
}

function heading1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function heading2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function body(text) {
  return new Paragraph({ spacing: { after: 160 }, children: [new TextRun(text)] });
}

// ---- Section: Prompt Template Used ----
const promptLines = systemPrompt.split("\n").map(
  line => new Paragraph({ children: [new TextRun({ text: line || " ", font: "Courier New", size: 18 })] })
);

// ---- Section: Custom Metric Definitions and Logic ----
const metricDetail = {
  fact_recall: [
    "Type: Automated (deterministic, no LLM call).",
    "Logic: each Key Fact is tokenized (lowercased, stopwords removed). " +
      "A fact counts as \"recalled\" if its token-overlap ratio with the " +
      "generated email meets the configured threshold (0.6 by default). " +
      "Score = recalled facts / total facts for that scenario.",
    "Rationale: deterministic and auditable, every fact's overlap ratio is " +
      "logged individually so a low score can be traced to exactly which " +
      "fact was dropped or paraphrased beyond recognition.",
  ],
  tone_fidelity: [
    "Type: LLM-as-judge, cross-judged by default.",
    "Logic: a judge model rates 1-5 how well the email's word choice and " +
      "sentence structure match the requested tone, returning a structured " +
      "{score, justification} object. Score is normalized to 0-1.",
    "Bias mitigation: since this project compares OpenAI vs. Gemini, a " +
      "single-provider judge would be biased toward its own family's " +
      "outputs (self-preference bias). Cross mode has both providers " +
      "judge both outputs and averages the two scores per email.",
  ],
  format_conciseness: [
    "Type: Automated (deterministic, no LLM call).",
    "Logic: weighted composite of three sub-scores: structural " +
      "completeness (subject line / greeting / sign-off present, 40%), " +
      "length ratio vs. the human reference email (30%), and Flesch " +
      "Reading Ease landing within a professional-writing band of 45-70 " +
      "(30%).",
    "Rationale: conciseness and structure are measurable without an LLM " +
      "judge, keeping two of the three metrics fully reproducible.",
  ],
};

const metricNiceNames = {
  fact_recall: "Custom Metric 1: Fact Recall",
  tone_fidelity: "Custom Metric 2: Tone Fidelity",
  format_conciseness: "Custom Metric 3: Format & Conciseness",
};

const metricSections = Object.keys(metricDetail).flatMap(key => [
  heading2(metricNiceNames[key]),
  ...metricDetail[key].map(line => body(line)),
]);

// ---- Section: Raw Evaluation Data ----
const rawHeaderRow = new TableRow({
  tableHeader: true,
  children: [
    cell("Scenario", 700, { bold: true }),
    cell("Intent", 2860, { bold: true }),
    cell("Provider", 1100, { bold: true }),
    cell("Fact Recall", 1500, { bold: true }),
    cell("Tone Fidelity", 1600, { bold: true }),
    cell("Format/Concise.", 1600, { bold: true }),
  ],
});

const rawDataRows = results.raw_results.map(r => new TableRow({
  children: [
    cell(r.scenario_id, 700),
    cell(r.intent, 2860),
    cell(r.provider, 1100),
    cell(r.fact_recall_score.toFixed(2), 1500),
    cell(r.tone_fidelity_score.toFixed(2), 1600),
    cell(r.format_conciseness_score.toFixed(2), 1600),
  ],
}));

const rawDataTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [700, 2860, 1100, 1500, 1600, 1600],
  rows: [rawHeaderRow, ...rawDataRows],
});

// ---- Section: Provider Averages ----
const providers = Object.keys(results.provider_averages);
const metricKeys = ["fact_recall_score", "tone_fidelity_score", "format_conciseness_score"];

const avgHeaderRow = new TableRow({
  tableHeader: true,
  children: [
    cell("Metric", 4680, { bold: true }),
    ...providers.map(p => cell(p, 4680 / providers.length, { bold: true })),
  ],
});
const avgRows = metricKeys.map(mk => new TableRow({
  children: [
    cell(mk, 4680),
    ...providers.map(p => cell(results.provider_averages[p][mk].toFixed(3), 4680 / providers.length)),
  ],
}));
const avgTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [4680, ...providers.map(() => 4680 / providers.length)],
  rows: [avgHeaderRow, ...avgRows],
});

// ---- Section: Comparative Analysis (auto-drafted, needs human pass) ----
function lowestScenarioFor(provider, metricKey) {
  const rows = results.raw_results.filter(r => r.provider === provider);
  return rows.reduce((min, r) => (r[metricKey] < min[metricKey] ? r : min), rows[0]);
}

const analysisParagraphs = [];
metricKeys.forEach(mk => {
  const winner = providers.reduce((best, p) =>
    results.provider_averages[p][mk] > results.provider_averages[best][mk] ? p : best, providers[0]);
  analysisParagraphs.push(body(
    `${metricNiceNames[mk.replace("_score", "")] || mk}: ${winner} scored higher on average ` +
    `(${providers.map(p => `${p}=${results.provider_averages[p][mk].toFixed(3)}`).join(", ")}).`
  ));
});

analysisParagraphs.push(heading2("Lowest-scoring examples (failure-mode evidence)"));
providers.forEach(p => {
  metricKeys.forEach(mk => {
    const worst = lowestScenarioFor(p, mk);
    analysisParagraphs.push(body(
      `${p} / ${mk}: lowest on scenario ${worst.scenario_id} ("${worst.intent}") at ` +
      `${worst[mk].toFixed(2)}. Inspect the scenario ${worst.scenario_id} / ${p} entry in ` +
      `eval_results.json for the generated email and (for tone_fidelity) the judge's justification text.`
    ));
  });
});

analysisParagraphs.push(
  heading2("TODO — Recommendation (requires your judgment)"),
  body(
    "The assessment asks which model you'd recommend for production and why, using the " +
    "custom metric data to justify it. The tables above give you the averages and the " +
    "specific low-scoring examples to cite, but the actual recommendation is a judgment " +
    "call this script won't make for you: weigh whether the cost/latency difference " +
    "between providers matters more than a small metric gap, and write 3-5 sentences here."
  )
);

if (isMockData) {
  analysisParagraphs.unshift(body(
    "NOTE: This report was generated from MOCK_MODE data (no real API calls were made). " +
    "Re-run `python run_eval.py` with real API keys and MOCK_MODE unset, then regenerate " +
    "this report before submitting."
  ));
}

// ---- Assemble document ----
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22, color: "000000" } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "000000" },
        paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "000000" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
    ],
  },
  background: { color: "FFFFFF" },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    children: [
      heading1("Email Generation Assistant: Final Report"),
      body(`Generated: ${results.generated_at}`),

      heading2("1. Prompt Template Used"),
      body("Technique: Role-Prompting + Few-Shot Example (see README.md for rationale). " +
        "The identical system prompt below is sent to both providers; only the per-scenario " +
        "Intent/Key Facts/Tone block changes."),
      ...promptLines,

      heading1("2. Custom Metric Definitions and Logic"),
      ...metricSections,

      heading1("3. Raw Evaluation Data"),
      body(`${results.raw_results.length} rows (10 scenarios x ${providers.length} providers). ` +
        "Full per-fact and per-judge detail is in reports/eval_results.json."),
      rawDataTable,
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: "Provider Averages", bold: true })] }),
      avgTable,

      heading1("4. Comparative Analysis"),
      ...analysisParagraphs,
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUT_PATH, buffer);
  console.log("Wrote", OUT_PATH);
});
