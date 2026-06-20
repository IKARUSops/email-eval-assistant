/**
 * Email Eval Assistant - Dashboard JavaScript
 * Handles scenario selection, generation, evaluation, display, copy/export, and theme toggling
 */

// Global state
window.scenarios = [];
window.selectedScenario = null;
window.selectedProviderChoice = 'both'; // 'both', 'openai', 'gemini'
window.selectedOpenAIModel = 'gpt-4o-mini';
window.selectedGeminiModel = 'gemini-3.1-flash-lite';
window.results = {
    openai: {},
    gemini: {}
};
window.cachedResults = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    await loadScenarios();
    await loadCachedResults();
    displaySummary();

    // Theme Toggle listener
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
});

/**
 * Initialize Dark/Light theme based on system preference or saved setting
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.className = savedTheme;
    } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.className = prefersDark ? 'dark-theme' : 'light-theme';
    }
}

/**
 * Toggle between Dark and Light themes
 */
function toggleTheme() {
    if (document.body.classList.contains('dark-theme')) {
        document.body.className = 'light-theme';
    } else {
        document.body.className = 'dark-theme';
    }
    localStorage.setItem('theme', document.body.className);
}

/**
 * Tab Navigation switcher
 */
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');

    if (tabName === 'presets') {
        document.getElementById('tabPresetBtn').classList.add('active');
        document.getElementById('presetsTabContent').style.display = 'block';
    } else if (tabName === 'custom') {
        document.getElementById('tabCustomBtn').classList.add('active');
        document.getElementById('customTabContent').style.display = 'block';
    }

    // Hide comparison section when switching tabs
    document.getElementById('comparisonSection').style.display = 'none';
    window.selectedScenario = null;
}

/**
 * Show/hide custom text inputs for model selectors
 */
function toggleCustomModelInput(provider) {
    const select = document.getElementById(provider === 'openai' ? 'customOpenAIModel' : 'customGeminiModel');
    const input = document.getElementById(provider === 'openai' ? 'customOpenAIModelText' : 'customGeminiModelText');
    if (select.value === 'custom') {
        input.style.display = 'block';
        input.focus();
    } else {
        input.style.display = 'none';
    }
}

/**
 * Load all preset test scenarios from the API
 */
async function loadScenarios() {
    try {
        const response = await fetch('/api/scenarios');
        window.scenarios = await response.json();
        renderScenarioList();
    } catch (error) {
        console.error('Failed to load scenarios:', error);
        document.getElementById('scenarioList').innerHTML = 
            '<div style="color: red;">Failed to load scenarios</div>';
    }
}

/**
 * Load cached results from eval_results.json if it exists
 */
async function loadCachedResults() {
    try {
        const response = await fetch('/api/results');
        const data = await response.json();
        window.cachedResults = data;
    } catch (error) {
        console.log('No cached results yet');
    }
}

/**
 * Render preset scenario items
 */
function renderScenarioList() {
    const list = document.getElementById('scenarioList');
    list.innerHTML = '';

    window.scenarios.forEach(scenario => {
        const item = document.createElement('div');
        item.className = 'scenario-item';
        item.innerHTML = `
            <div class="scenario-id">Scenario ${scenario.id}</div>
            <div class="scenario-intent">${scenario.intent}</div>
            <div class="scenario-tone">Tone: ${scenario.tone}</div>
        `;
        item.onclick = () => selectScenario(scenario);
        list.appendChild(item);
    });
}

/**
 * Select a preset scenario
 */
function selectScenario(scenario) {
    window.selectedScenario = scenario;
    window.selectedProviderChoice = 'both';
    window.selectedOpenAIModel = 'gpt-4o-mini';
    window.selectedGeminiModel = 'gemini-3.1-flash-lite';
    
    // Update active state in list
    document.querySelectorAll('.scenario-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.scenario-item')?.classList.add('active');

    // Restore both columns
    document.getElementById('openaiColumn').style.display = 'flex';
    document.getElementById('geminiColumn').style.display = 'flex';
    document.getElementById('openaiFactRecallRow').style.display = 'flex';
    document.getElementById('geminiFactRecallRow').style.display = 'flex';
    document.getElementById('openaiToneFidelityRow').style.display = 'flex';
    document.getElementById('geminiToneFidelityRow').style.display = 'flex';
    document.getElementById('openaiFormatConcisenessRow').style.display = 'flex';
    document.getElementById('geminiFormatConcisenessRow').style.display = 'flex';

    // Update column titles
    document.getElementById('openaiHeaderTitle').textContent = `🤖 OpenAI (${window.selectedOpenAIModel})`;
    document.getElementById('geminiHeaderTitle').textContent = `🤖 Gemini (${window.selectedGeminiModel})`;

    // Show comparison section and populate
    document.getElementById('comparisonSection').style.display = 'block';
    document.getElementById('selectedScenarioId').textContent = `Scenario ${scenario.id}`;

    // Render details
    const detailsHtml = `
        <div class="detail-row">
            <div class="detail-label">Intent</div>
            <div class="detail-value">${scenario.intent}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Key Facts to Include</div>
            <ul class="facts-list">
                ${scenario.key_facts.map(fact => `<li>${fact}</li>`).join('')}
            </ul>
        </div>
        <div class="detail-row">
            <div class="detail-label">Requested Tone</div>
            <div class="detail-value"><strong>${scenario.tone}</strong></div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Reference Email</div>
            <div class="email-box" style="max-height: 200px;">${scenario.reference_email}</div>
        </div>
    `;
    document.getElementById('scenarioDetails').innerHTML = detailsHtml;

    // Reset fields
    document.getElementById('openaiEmail').textContent = 'Generate to see email...';
    document.getElementById('geminiEmail').textContent = 'Generate to see email...';
    resetScores();
    document.getElementById('detailsSection').style.display = 'none';

    // Try to load cached results for this preset
    if (window.cachedResults && window.cachedResults.raw_results) {
        const cached = window.cachedResults.raw_results.filter(r => r.scenario_id === scenario.id);
        if (cached.length === 2) {
            displayCachedResults(cached);
        }
    }

    document.getElementById('comparisonSection').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Handle custom scenario playground submission
 */
function submitCustomScenario() {
    const intent = document.getElementById('customIntent').value.trim();
    const factsRaw = document.getElementById('customKeyFacts').value.trim();
    const tone = document.getElementById('customTone').value.trim();
    const refEmail = document.getElementById('customReferenceEmail').value.trim();

    const providerSelect = document.getElementById('providerChoice').value;
    window.selectedProviderChoice = providerSelect;

    // Determine selected OpenAI model
    const oaiSelect = document.getElementById('customOpenAIModel').value;
    window.selectedOpenAIModel = oaiSelect === 'custom' ? 
        document.getElementById('customOpenAIModelText').value.trim() : oaiSelect;

    // Determine selected Gemini model
    const geminiSelect = document.getElementById('customGeminiModel').value;
    window.selectedGeminiModel = geminiSelect === 'custom' ? 
        document.getElementById('customGeminiModelText').value.trim() : geminiSelect;

    const keyFacts = factsRaw.split('\n').map(f => f.trim()).filter(f => f.length > 0);

    const customScenario = {
        id: 'custom_' + Date.now().toString().slice(-6),
        intent: intent,
        key_facts: keyFacts,
        tone: tone,
        reference_email: refEmail
    };

    window.selectedScenario = customScenario;

    // Set Column visibilities
    const oaiCol = document.getElementById('openaiColumn');
    const gemCol = document.getElementById('geminiColumn');
    const oaiFactRow = document.getElementById('openaiFactRecallRow');
    const gemFactRow = document.getElementById('geminiFactRecallRow');
    const oaiToneRow = document.getElementById('openaiToneFidelityRow');
    const gemToneRow = document.getElementById('geminiToneFidelityRow');
    const oaiFormatRow = document.getElementById('openaiFormatConcisenessRow');
    const gemFormatRow = document.getElementById('geminiFormatConcisenessRow');

    oaiCol.style.display = (providerSelect === 'openai' || providerSelect === 'both') ? 'flex' : 'none';
    gemCol.style.display = (providerSelect === 'gemini' || providerSelect === 'both') ? 'flex' : 'none';

    oaiFactRow.style.display = (providerSelect === 'openai' || providerSelect === 'both') ? 'flex' : 'none';
    gemFactRow.style.display = (providerSelect === 'gemini' || providerSelect === 'both') ? 'flex' : 'none';
    oaiToneRow.style.display = (providerSelect === 'openai' || providerSelect === 'both') ? 'flex' : 'none';
    gemToneRow.style.display = (providerSelect === 'gemini' || providerSelect === 'both') ? 'flex' : 'none';
    oaiFormatRow.style.display = (providerSelect === 'openai' || providerSelect === 'both') ? 'flex' : 'none';
    gemFormatRow.style.display = (providerSelect === 'gemini' || providerSelect === 'both') ? 'flex' : 'none';

    // Update column headers
    document.getElementById('openaiHeaderTitle').textContent = `🤖 OpenAI (${window.selectedOpenAIModel || 'Default'})`;
    document.getElementById('geminiHeaderTitle').textContent = `🤖 Gemini (${window.selectedGeminiModel || 'Default'})`;

    // Show comparison section
    document.getElementById('comparisonSection').style.display = 'block';
    document.getElementById('selectedScenarioId').textContent = 'Custom Scenario';

    // Render details
    const detailsHtml = `
        <div class="detail-row">
            <div class="detail-label">Intent</div>
            <div class="detail-value">${intent}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Key Facts to Include</div>
            <ul class="facts-list">
                ${keyFacts.map(fact => `<li>${fact}</li>`).join('')}
            </ul>
        </div>
        <div class="detail-row">
            <div class="detail-label">Requested Tone</div>
            <div class="detail-value"><strong>${tone}</strong></div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Reference Email</div>
            <div class="email-box" style="max-height: 200px;">${refEmail || '<span style="color: var(--neutral-400);">No reference email provided</span>'}</div>
        </div>
    `;
    document.getElementById('scenarioDetails').innerHTML = detailsHtml;

    // Reset scores & boxes
    document.getElementById('openaiEmail').textContent = 'Generate to see email...';
    document.getElementById('geminiEmail').textContent = 'Generate to see email...';
    resetScores();
    document.getElementById('detailsSection').style.display = 'none';

    // Automatically trigger generation for selected providers
    generateCustomScenarioEmails();

    document.getElementById('comparisonSection').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Generate emails for custom scenarios
 */
async function generateCustomScenarioEmails() {
    const promises = [];
    if (window.selectedProviderChoice === 'openai' || window.selectedProviderChoice === 'both') {
        promises.push(generateEmail(window.selectedScenario, 'openai', window.selectedOpenAIModel));
    }
    if (window.selectedProviderChoice === 'gemini' || window.selectedProviderChoice === 'both') {
        promises.push(generateEmail(window.selectedScenario, 'gemini', window.selectedGeminiModel));
    }
    await Promise.all(promises);
}

/**
 * Trigger regenerate from the side columns
 */
function runSingleGeneration(provider) {
    const model = provider === 'openai' ? window.selectedOpenAIModel : window.selectedGeminiModel;
    generateEmail(window.selectedScenario, provider, model);
}

/**
 * Display cached results in boxes
 */
function displayCachedResults(cachedRows) {
    cachedRows.forEach(row => {
        if (row.provider === 'openai') {
            document.getElementById('openaiEmail').textContent = row.generated_email;
            window.results.openai = row;
            displayScores('openai', row);
        } else if (row.provider === 'gemini') {
            document.getElementById('geminiEmail').textContent = row.generated_email;
            window.results.gemini = row;
            displayScores('gemini', row);
        }
    });
}

/**
 * Core API email generation
 */
async function generateEmail(scenario, provider, modelOverride = null) {
    if (!scenario) return;

    const emailBox = provider === 'openai' ? 
        document.getElementById('openaiEmail') : 
        document.getElementById('geminiEmail');

    emailBox.textContent = `Generating with ${provider}...`;

    try {
        const payload = {
            scenario_id: scenario.id,
            provider: provider
        };

        // If custom scenario or custom model parameter is passed, send inline params
        if (scenario.id.toString().startsWith('custom_') || modelOverride) {
            payload.intent = scenario.intent;
            payload.key_facts = scenario.key_facts;
            payload.tone = scenario.tone;
            payload.model = modelOverride;
        }

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);
        
        const data = await response.json();
        window.results[provider].generated_email = data.generated_email;
        emailBox.textContent = data.generated_email;

    } catch (error) {
        console.error('Generation failed:', error);
        emailBox.textContent = `❌ Error: ${error.message}`;
    }
}

/**
 * Evaluates both active emails on the metrics
 */
async function evaluateBoth() {
    const scenario = window.selectedScenario;
    if (!scenario) return;

    const openaiEmail = document.getElementById('openaiEmail').textContent;
    const geminiEmail = document.getElementById('geminiEmail').textContent;

    const runOai = (window.selectedProviderChoice === 'openai' || window.selectedProviderChoice === 'both');
    const runGem = (window.selectedProviderChoice === 'gemini' || window.selectedProviderChoice === 'both');

    if (runOai && (!openaiEmail.trim() || openaiEmail.includes('Generate to see') || openaiEmail.includes('Generating with'))) {
        alert('Please generate OpenAI email first');
        return;
    }
    if (runGem && (!geminiEmail.trim() || geminiEmail.includes('Generate to see') || geminiEmail.includes('Generating with'))) {
        alert('Please generate Gemini email first');
        return;
    }

    const button = document.getElementById('evaluateBtn');
    button.disabled = true;
    button.textContent = 'Evaluating...';

    try {
        const promises = [];

        if (runOai) {
            promises.push((async () => {
                const payload = {
                    scenario_id: scenario.id,
                    email_text: openaiEmail
                };
                if (scenario.id.toString().startsWith('custom_')) {
                    payload.key_facts = scenario.key_facts;
                    payload.tone = scenario.tone;
                    payload.reference_email = scenario.reference_email;
                }
                const response = await fetch('/api/evaluate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response.ok) {
                    const data = await response.json();
                    window.results.openai = { ...window.results.openai, ...data };
                    displayScores('openai', data);
                } else {
                    throw new Error('OpenAI evaluation failed');
                }
            })());
        }

        if (runGem) {
            promises.push((async () => {
                const payload = {
                    scenario_id: scenario.id,
                    email_text: geminiEmail
                };
                if (scenario.id.toString().startsWith('custom_')) {
                    payload.key_facts = scenario.key_facts;
                    payload.tone = scenario.tone;
                    payload.reference_email = scenario.reference_email;
                }
                const response = await fetch('/api/evaluate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response.ok) {
                    const data = await response.json();
                    window.results.gemini = { ...window.results.gemini, ...data };
                    displayScores('gemini', data);
                } else {
                    throw new Error('Gemini evaluation failed');
                }
            })());
        }

        await Promise.all(promises);

        // Show details breakdown
        document.getElementById('detailsSection').style.display = 'block';
        displayDetails();

    } catch (error) {
        console.error('Evaluation failed:', error);
        alert(`Evaluation error: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = 'Evaluate Output';
    }
}

/**
 * Display scores for a provider
 */
function displayScores(provider, data) {
    const prefix = provider === 'openai' ? 'openai' : 'gemini';
    
    const factRecall = data.fact_recall?.score ?? data.fact_recall_score ?? '—';
    const toneFidelity = data.tone_fidelity?.score ?? data.tone_fidelity_score ?? '—';
    const formatConciseness = data.format_conciseness?.score ?? data.format_conciseness_score ?? '—';

    document.getElementById(`${prefix}FactRecall`).textContent = 
        typeof factRecall === 'number' ? factRecall.toFixed(3) : '—';
    document.getElementById(`${prefix}ToneFidelity`).textContent = 
        typeof toneFidelity === 'number' ? toneFidelity.toFixed(3) : '—';
    document.getElementById(`${prefix}FormatConciseness`).textContent = 
        typeof formatConciseness === 'number' ? formatConciseness.toFixed(3) : '—';
}

/**
 * Reset all score displays
 */
function resetScores() {
    ['openaiFactRecall', 'openaiToneFidelity', 'openaiFormatConciseness',
     'geminiFactRecall', 'geminiToneFidelity', 'geminiFormatConciseness'].forEach(id => {
        document.getElementById(id).textContent = '—';
    });
}

/**
 * Display detailed, step-by-step breakdown of scores
 */
function displayDetails() {
    const openaiData = window.results.openai;
    const geminiData = window.results.gemini;

    const runOai = (window.selectedProviderChoice === 'openai' || window.selectedProviderChoice === 'both');
    const runGem = (window.selectedProviderChoice === 'gemini' || window.selectedProviderChoice === 'both');

    let html = '';

    // 1. FACT RECALL DETAILED STEP
    html += `
    <div class="step-fact-recall">
        <div class="step-title">✅ Step 1: Fact Recall Calculation</div>
        <p style="margin-bottom:12px; font-size:0.9rem;">
            Matches key facts by token overlap percentage against the target threshold of <strong>0.60 (60%)</strong>.
        </p>
        <div class="step-grid">
    `;

    // OpenAI Fact Recall details
    if (runOai) {
        html += `
            <div class="step-column">
                <h4>OpenAI Fact Breakdown</h4>
                <ul class="fact-item-list">
        `;
        if (openaiData.fact_recall?.details && openaiData.fact_recall.details.length > 0) {
            openaiData.fact_recall.details.forEach(d => {
                const icon = d.recalled ? '✅' : '❌';
                const cls = d.recalled ? 'recalled' : 'missed';
                html += `
                    <li>
                        <span class="fact-status-icon ${cls}">${icon}</span>
                        <span class="fact-text">${escapeHtml(d.fact)}</span>
                        <span class="fact-ratio">${(d.overlap_ratio * 100).toFixed(0)}% overlap</span>
                    </li>
                `;
            });
        } else {
            html += `<li>No facts checked</li>`;
        }
        html += `
                </ul>
                <div style="margin-top:12px; font-weight:600; font-size:0.95rem;">
                    Score: ${openaiData.fact_recall?.score?.toFixed(3) ?? '0.000'} (${openaiData.fact_recall?.details?.filter(d => d.recalled).length || 0}/${openaiData.fact_recall?.details?.length || 0} facts recalled)
                </div>
            </div>
        `;
    }

    // Gemini Fact Recall details
    if (runGem) {
        html += `
            <div class="step-column">
                <h4>Gemini Fact Breakdown</h4>
                <ul class="fact-item-list">
        `;
        if (geminiData.fact_recall?.details && geminiData.fact_recall.details.length > 0) {
            geminiData.fact_recall.details.forEach(d => {
                const icon = d.recalled ? '✅' : '❌';
                const cls = d.recalled ? 'recalled' : 'missed';
                html += `
                    <li>
                        <span class="fact-status-icon ${cls}">${icon}</span>
                        <span class="fact-text">${escapeHtml(d.fact)}</span>
                        <span class="fact-ratio">${(d.overlap_ratio * 100).toFixed(0)}% overlap</span>
                    </li>
                `;
            });
        } else {
            html += `<li>No facts checked</li>`;
        }
        html += `
                </ul>
                <div style="margin-top:12px; font-weight:600; font-size:0.95rem;">
                    Score: ${geminiData.fact_recall?.score?.toFixed(3) ?? '0.000'} (${geminiData.fact_recall?.details?.filter(d => d.recalled).length || 0}/${geminiData.fact_recall?.details?.length || 0} facts recalled)
                </div>
            </div>
        `;
    }
    html += `</div></div>`; // End of Fact Recall Section


    // 2. TONE FIDELITY DETAILED STEP
    html += `
    <div class="step-tone-fidelity">
        <div class="step-title">🧠 Step 2: Tone Fidelity (LLM Judge)</div>
        <p style="margin-bottom:12px; font-size:0.9rem;">
            Impartial judges evaluate tone on a 1-5 rubric. Cross-judgment is averaged to prevent bias.
        </p>
        <div class="step-grid">
    `;

    // OpenAI Tone Details
    if (runOai) {
        html += `
            <div class="step-column">
                <h4>OpenAI Judgment</h4>
        `;
        if (openaiData.tone_fidelity?.judgments && openaiData.tone_fidelity.judgments.length > 0) {
            openaiData.tone_fidelity.judgments.forEach(j => {
                html += `
                    <div class="tone-justification-box">
                        <div class="judge-header">Judge: ${j.judge} (Score: ${j.score}/5)</div>
                        <div>"${escapeHtml(j.justification)}"</div>
                    </div>
                `;
            });
        } else if (openaiData.tone_fidelity?.judgments) {
            // Fallback for single judge
            html += `<p>Judgments: ${JSON.stringify(openaiData.tone_fidelity.judgments)}</p>`;
        }
        html += `
                <div style="margin-top:12px; font-weight:600; font-size:0.95rem;">
                    Normalized Score: ${openaiData.tone_fidelity?.score?.toFixed(3) ?? '0.000'}
                </div>
            </div>
        `;
    }

    // Gemini Tone Details
    if (runGem) {
        html += `
            <div class="step-column">
                <h4>Gemini Judgment</h4>
        `;
        if (geminiData.tone_fidelity?.judgments && geminiData.tone_fidelity.judgments.length > 0) {
            geminiData.tone_fidelity.judgments.forEach(j => {
                html += `
                    <div class="tone-justification-box">
                        <div class="judge-header">Judge: ${j.judge} (Score: ${j.score}/5)</div>
                        <div>"${escapeHtml(j.justification)}"</div>
                    </div>
                `;
            });
        } else if (geminiData.tone_fidelity?.judgments) {
            html += `<p>Judgments: ${JSON.stringify(geminiData.tone_fidelity.judgments)}</p>`;
        }
        html += `
                <div style="margin-top:12px; font-weight:600; font-size:0.95rem;">
                    Normalized Score: ${geminiData.tone_fidelity?.score?.toFixed(3) ?? '0.000'}
                </div>
            </div>
        `;
    }
    html += `</div></div>`; // End of Tone Fidelity Section


    // 3. FORMAT & CONCISENESS DETAILED STEP
    html += `
    <div class="step-format-conciseness">
        <div class="step-title">📏 Step 3: Format & Conciseness Calculations</div>
        <p style="margin-bottom:12px; font-size:0.9rem;">
            Weighted composite score: <strong>40% Structure</strong> (Subject/Greeting/Sign-off), <strong>30% Length Ratio</strong> (deviation from human ref), and <strong>30% Readability</strong> (Flesch target band 45-70).
        </p>
        <div class="step-grid">
    `;

    // OpenAI Format details
    if (runOai) {
        const struc = openaiData.format_conciseness?.structure_score ?? 0;
        const len = openaiData.format_conciseness?.length_ratio_score ?? 0;
        const read = openaiData.format_conciseness?.readability_score ?? 0;
        const comp = openaiData.format_conciseness?.score ?? 0;
        html += `
            <div class="step-column">
                <h4>OpenAI Format breakdown</h4>
                <table class="format-math-table">
                    <thead>
                        <tr><th>Sub-Metric</th><th>Score</th><th>Weight</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>Structure</td><td>${struc.toFixed(3)}</td><td>40%</td></tr>
                        <tr><td>Length Ratio</td><td>${len.toFixed(3)}</td><td>30%</td></tr>
                        <tr><td>Readability</td><td>${read.toFixed(3)}</td><td>30%</td></tr>
                    </tbody>
                </table>
                <div class="format-formula-box">
                    (${struc.toFixed(2)} * 0.4) + (${len.toFixed(2)} * 0.3) + (${read.toFixed(2)} * 0.3) = ${comp.toFixed(3)}
                </div>
            </div>
        `;
    }

    // Gemini Format details
    if (runGem) {
        const struc = geminiData.format_conciseness?.structure_score ?? 0;
        const len = geminiData.format_conciseness?.length_ratio_score ?? 0;
        const read = geminiData.format_conciseness?.readability_score ?? 0;
        const comp = geminiData.format_conciseness?.score ?? 0;
        html += `
            <div class="step-column">
                <h4>Gemini Format breakdown</h4>
                <table class="format-math-table">
                    <thead>
                        <tr><th>Sub-Metric</th><th>Score</th><th>Weight</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>Structure</td><td>${struc.toFixed(3)}</td><td>40%</td></tr>
                        <tr><td>Length Ratio</td><td>${len.toFixed(3)}</td><td>30%</td></tr>
                        <tr><td>Readability</td><td>${read.toFixed(3)}</td><td>30%</td></tr>
                    </tbody>
                </table>
                <div class="format-formula-box">
                    (${struc.toFixed(2)} * 0.4) + (${len.toFixed(2)} * 0.3) + (${read.toFixed(2)} * 0.3) = ${comp.toFixed(3)}
                </div>
            </div>
        `;
    }
    html += `</div></div>`; // End of Format Section

    document.getElementById('detailsContent').innerHTML = html;
}

/**
 * Display preset summary comparison
 */
function displaySummary() {
    if (!window.cachedResults || !window.cachedResults.raw_results || 
        window.cachedResults.raw_results.length === 0) {
        document.getElementById('summaryGrid').innerHTML = `
            <div class="summary-card">
                <p>No evaluation results yet.</p>
                <p style="font-size: 0.9rem; margin-top: 8px; color: var(--neutral-500);">
                    Run <code>python run_eval.py</code> to generate results, then refresh this page.
                </p>
            </div>
        `;
        return;
    }

    const results = window.cachedResults;
    const averages = results.provider_averages || {};

    let html = '';

    // Fact Recall
    const openaiFactRecall = averages.openai?.fact_recall_score ?? 0;
    const geminiFactRecall = averages.gemini?.fact_recall_score ?? 0;
    html += `
        <div class="summary-card">
            <div class="metric-name">✅ Fact Recall</div>
            <div class="winner">${openaiFactRecall > geminiFactRecall ? 'OpenAI' : 'Gemini'}</div>
            <div class="scores">
                <span>OpenAI: ${openaiFactRecall.toFixed(3)}</span>
                <span>Gemini: ${geminiFactRecall.toFixed(3)}</span>
            </div>
        </div>
    `;

    // Tone Fidelity
    const openaiTone = averages.openai?.tone_fidelity_score ?? 0;
    const geminiTone = averages.gemini?.tone_fidelity_score ?? 0;
    html += `
        <div class="summary-card">
            <div class="metric-name">🧠 Tone Fidelity</div>
            <div class="winner">${openaiTone > geminiTone ? 'OpenAI' : 'Gemini'}</div>
            <div class="scores">
                <span>OpenAI: ${openaiTone.toFixed(3)}</span>
                <span>Gemini: ${geminiTone.toFixed(3)}</span>
            </div>
        </div>
    `;

    // Format & Conciseness
    const openaiFormat = averages.openai?.format_conciseness_score ?? 0;
    const geminiFormat = averages.gemini?.format_conciseness_score ?? 0;
    html += `
        <div class="summary-card">
            <div class="metric-name">📏 Format & Conciseness</div>
            <div class="winner">${openaiFormat > geminiFormat ? 'OpenAI' : 'Gemini'}</div>
            <div class="scores">
                <span>OpenAI: ${openaiFormat.toFixed(3)}</span>
                <span>Gemini: ${geminiFormat.toFixed(3)}</span>
            </div>
        </div>
    `;

    document.getElementById('summaryGrid').innerHTML = html;
}

/**
 * Go back to presets or playground form view
 */
function backToSummary() {
    document.getElementById('comparisonSection').style.display = 'none';
    window.selectedScenario = null;
    document.querySelectorAll('.scenario-item').forEach(item => {
        item.classList.remove('active');
    });
}

/**
 * Helper to copy generated email text to clipboard
 */
function copyToClipboard(provider) {
    const box = document.getElementById(provider === 'openai' ? 'openaiEmail' : 'geminiEmail');
    const text = box.textContent;

    if (!text || text.includes('Generate to see') || text.includes('Generating with')) {
        alert('Nothing to copy yet!');
        return;
    }

    navigator.clipboard.writeText(text).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied! ✓';
        setTimeout(() => btn.textContent = originalText, 1500);
    }).catch(err => {
        console.error('Failed to copy text:', err);
    });
}

/**
 * Export Comparison Report in multiple formats
 */
function exportReport(format = 'txt') {
    const dropdown = document.getElementById('exportDropdown');
    if (dropdown) dropdown.style.display = 'none';
    
    if (!window.selectedScenario) return;

    let report = `EMAIL EVALUATION REPORT\n`;
    report += `=========================\n`;
    report += `Scenario ID: ${window.selectedScenario.id}\n`;
    report += `Intent: ${window.selectedScenario.intent}\n`;
    report += `Requested Tone: ${window.selectedScenario.tone}\n\n`;
    
    report += `KEY FACTS:\n`;
    window.selectedScenario.key_facts.forEach(f => {
        report += `- ${f}\n`;
    });
    report += `\n`;

    const runOai = (window.selectedProviderChoice === 'openai' || window.selectedProviderChoice === 'both');
    const runGem = (window.selectedProviderChoice === 'gemini' || window.selectedProviderChoice === 'both');

    if (runOai) {
        report += `-------------------------\n`;
        report += `OPENAI (${window.selectedOpenAIModel})\n`;
        report += `-------------------------\n`;
        report += `Email Output:\n${document.getElementById('openaiEmail').textContent}\n\n`;
        report += `Scores:\n`;
        report += `- Fact Recall: ${document.getElementById('openaiFactRecall').textContent}\n`;
        report += `- Tone Fidelity: ${document.getElementById('openaiToneFidelity').textContent}\n`;
        report += `- Format & Conciseness: ${document.getElementById('openaiFormatConciseness').textContent}\n\n`;
    }

    if (runGem) {
        report += `-------------------------\n`;
        report += `GEMINI (${window.selectedGeminiModel})\n`;
        report += `-------------------------\n`;
        report += `Email Output:\n${document.getElementById('geminiEmail').textContent}\n\n`;
        report += `Scores:\n`;
        report += `- Fact Recall: ${document.getElementById('geminiFactRecall').textContent}\n`;
        report += `- Tone Fidelity: ${document.getElementById('geminiToneFidelity').textContent}\n`;
        report += `- Format & Conciseness: ${document.getElementById('geminiFormatConciseness').textContent}\n\n`;
    }

    const filename = `email_comparison_${window.selectedScenario.id}`;

    if (format === 'txt' || format === 'md') {
        let textData = report;
        if (format === 'md') {
            textData = report.replace(/=========================/g, '').replace(/-------------------------/g, '---').replace(/EMAIL EVALUATION REPORT/, '# EMAIL EVALUATION REPORT');
        }
        const blob = new Blob([textData], { type: 'text/plain' });
        downloadBlob(blob, `${filename}.${format}`);
    } else if (format === 'pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(report, 180);
        let cursorY = 10;
        lines.forEach(line => {
            if (cursorY > 280) {
                doc.addPage();
                cursorY = 10;
            }
            doc.text(line, 10, cursorY);
            cursorY += 5;
        });
        doc.save(`${filename}.pdf`);
    } else if (format === 'docx') {
        const paragraphs = report.split('\n').map(line => new docx.Paragraph({ children: [new docx.TextRun(line)] }));
        const doc = new docx.Document({
            sections: [{
                properties: {},
                children: paragraphs
            }]
        });
        docx.Packer.toBlob(doc).then(blob => {
            downloadBlob(blob, `${filename}.docx`);
        });
    }
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Close export dropdown when clicking outside
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('exportDropdown');
    if (!dropdown) return;
    const btn = document.querySelector('.comparison-actions .btn');
    if (!dropdown.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

/**
 * Escapes HTML characters to prevent XSS in dynamic DOM formatting
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
