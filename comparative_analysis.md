# Model Comparison and Analysis

Based on the evaluation of 10 distinct email generation scenarios using our three custom metrics, here is the comparative analysis between OpenAI (gpt-4o-mini) and Gemini (gemini-3.1-flash-lite).

## 1. Which model performed better?
**OpenAI performed better overall**, winning clearly on two out of the three custom metrics. 
- **Fact Recall**: OpenAI narrowly won (0.908 vs. 0.900), proving slightly more reliable at integrating all requested key facts into the email.
- **Format & Conciseness**: OpenAI won significantly (0.808 vs. 0.724), demonstrating a much better grasp of brevity and standard email structural norms.
- **Tone Fidelity**: Gemini scored a narrow victory here (0.930 vs. 0.920). Both models proved highly capable of adapting to varying tones (from casual to empathetic to formal), but the LLM-as-a-judge system slightly preferred Gemini's emotional phrasing in specific scenarios like customer complaint responses.

## 2. Biggest failure mode of the lower-performing model
The biggest failure mode for the lower-performing model (**Gemini**) was **extreme verbosity**, which severely penalized its Format & Conciseness score. 

When analyzing the raw data, Gemini repeatedly scored near `0.0` on the `length_ratio_score` sub-metric (for example, in Scenario 4: Server Downtime, its length score was exactly `0.000`, and in Scenario 6: Customer Complaint, it scored `0.016`). Gemini consistently generated highly padded, lengthy paragraphs that deviated drastically from the concise, punchy human reference emails. While it hit all the necessary facts and tones, it failed to recognize that modern professional communication requires brevity.

## 3. Production Recommendation
**I recommend OpenAI for production.** 

While both models are practically tied in their ability to adopt a specific persona (Tone Fidelity) and include necessary information (Fact Recall), **OpenAI's superior formatting and conciseness make it the clear winner for an email generation product.**

In professional environments, emails must be brief and easily scannable; users do not want to send—nor do recipients want to read—walls of text. Gemini's tendency to hallucinate excessive conversational padding makes it a liability for quick, automated business communications. OpenAI generated emails that were reliably dense with facts but structurally tight, meaning it requires significantly less human editing before clicking "Send."
