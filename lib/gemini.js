const API_KEY = process.env.GEMINI_API_KEY;
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Overridable without a code change — Google retires model ids on their own schedule
// and the API then refuses the old name outright. `gemini-flash-lite-latest` is the
// moving alias if you would rather not pin.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

/** Credit exhaustion and per-minute throttling both surface as RESOURCE_EXHAUSTED. */
function isBillingExhausted(payload) {
  const m = payload?.error?.message || "";
  return /prepayment credits|billing|quota.*depleted/i.test(m);
}

function geminiError(payload, status) {
  const message = payload?.error?.message || `Gemini error ${status}`;

  // Google names the replacement in the body when a model is retired. Surface it
  // instead of letting a wall of prose reach the user.
  const replacement = message.match(/use\s+models\/([\w.-]+)/i)?.[1];
  if (replacement) {
    return new Error(
      `Model "${MODEL}" is no longer available. Set GEMINI_MODEL=${replacement} in .env.local and restart.`
    );
  }

  if (isBillingExhausted(payload)) {
    return new Error(
      "Your Gemini API credits are used up. Top up at https://ai.studio/projects, or create a key on a project without billing to use the free tier."
    );
  }

  if (status === 429) {
    return new Error("Gemini rate limit hit. Wait a moment and try again.");
  }

  return new Error(message);
}

/**
 * One Gemini call. Returns { text, grounded } so callers can tell whether Google
 * Search actually ran — grounding has its own quota and is commonly unavailable on
 * free keys, in which case we fall back to the model's own knowledge rather than
 * failing the whole request.
 */
async function callGemini(prompt, { useSearch = false, temperature = 0.7, maxOutputTokens = 2000, jsonMode = false } = {}) {
  if (!API_KEY) throw new Error("GEMINI_API_KEY is not set");

  const send = async (withSearch) => {
    const generationConfig = { temperature, maxOutputTokens };
    // Gemini's JSON mode guarantees parseable output — no markdown fences to strip.
    // It cannot be combined with tool use, so it is skipped on grounded calls.
    if (jsonMode && !withSearch) generationConfig.responseMimeType = "application/json";

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    };
    if (withSearch) body.tools = [{ google_search: {} }];

    const res = await fetch(`${BASE_URL}/${MODEL}:generateContent?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, payload };
  };

  let attempt = await send(useSearch);

  // Grounding is metered separately from generation. If only the search tool is
  // rejected, retry ungrounded — a briefing from model knowledge beats no briefing.
  const groundingRefused =
    useSearch &&
    !attempt.ok &&
    !isBillingExhausted(attempt.payload) &&
    (attempt.status === 429 || attempt.payload?.error?.status === "RESOURCE_EXHAUSTED");

  let grounded = useSearch;
  if (groundingRefused) {
    console.warn("Gemini: Google Search grounding unavailable (quota) — retrying without it.");
    grounded = false;
    attempt = await send(false);
  }

  if (!attempt.ok) throw geminiError(attempt.payload, attempt.status);

  const candidate = attempt.payload.candidates?.[0];
  const text =
    candidate?.content?.parts
      ?.filter((p) => p.text)
      .map((p) => p.text)
      .join("") || "";

  if (!text) {
    const reason = candidate?.finishReason;
    if (reason === "MAX_TOKENS") {
      throw new Error(
        `Gemini hit the ${maxOutputTokens}-token output limit before producing text (the model's own reasoning counts against it). Raise maxOutputTokens.`
      );
    }
    if (reason === "SAFETY" || reason === "PROHIBITED_CONTENT") {
      throw new Error("Gemini blocked this content under its safety filters.");
    }
    throw new Error(`Gemini returned an empty response${reason ? ` (${reason})` : ""}.`);
  }

  return { text, grounded };
}

export async function generateResponse(prompt, useSearch = false, opts = {}) {
  const { text } = await callGemini(prompt, { ...opts, useSearch });
  return text;
}

export async function researchCompany(companyName, jobTitle) {
  const prompt = `Research the company "${companyName}" for a candidate applying for a "${jobTitle}" role.

Provide a concise briefing covering:
1. What the company does (2-3 sentences)
2. Culture & values (key points)
3. Recent news or notable developments
4. What they typically look for in candidates
5. One insider insight that would help in an interview

Keep it practical and actionable. Use clear section headers.`;

  const { text, grounded } = await callGemini(prompt, { useSearch: true, maxOutputTokens: 4096 });

  // Be explicit when this is recall rather than live search — "recent news" from an
  // ungrounded model is exactly the thing that embarrasses you in an interview.
  const note = grounded
    ? ""
    : `> ⚠️ Live web search was unavailable, so this is from the model's training data and may be out of date. Verify anything time-sensitive.\n\n`;

  return { insights: note + text, grounded };
}

export function buildCoachContext(cvText, jobDescription, companyInsights, recentLogs = []) {
  const logLines = recentLogs
    .map(l => `- [${l.logged_at}] ${l.context_name ? `(${l.context_name}) ` : ""}${l.ai_summary || ""}${l.impact_statement ? ` — ${l.impact_statement}` : ""}`)
    .join("\n");

  const logBlock = logLines
    ? `
=== RECENT WORK LOG (last 90 days — may NOT yet appear on the CV) ===
${logLines}

Treat this as verified evidence the candidate has but may not have packaged. If a gap in
the CV is actually covered by this log, say so and tell them exactly how to phrase it.`
    : "";

  return `You are an expert career coach helping a candidate apply for a specific role.

=== CANDIDATE CV ===
${cvText || "No CV provided."}

=== JOB DESCRIPTION ===
${jobDescription || "No job description provided."}
${companyInsights
      ? `
=== COMPANY INSIGHTS (from research) ===
${companyInsights}`
      : ""
    }${logBlock}

=== YOUR COACHING STYLE ===
- Direct, practical, and concise
- Gap analysis: separate REAL gaps (no evidence anywhere) from PACKAGING gaps (evidence exists
  in the work log but is missing or buried in the CV) — these need very different advice
- Cover letters: compelling and specific, never generic
- Application questions: craft authentic answers grounded in the CV and work log
- Strategy: actionable steps the candidate can take right now
- Use company insights where relevant for context-aware advice
- Never invent experience the candidate has not evidenced`;
}

/**
 * Extract structured insights from a raw work log entry.
 * Returns JSON: { summary, skills, domains, impact_statement }
 */
export async function extractWorkLogInsights(rawText, contextType, contextName) {
  const contextStr = contextName
    ? `${contextType} work for "${contextName}"`
    : contextType || "unspecified context";

  const prompt = `You are a career intelligence assistant. A professional has logged the following work activity (${contextStr}):

---
${rawText}
---

Extract and return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "summary": "One concise sentence describing what was done",
  "skills": ["skill1", "skill2", "skill3"],
  "domains": ["domain1", "domain2"],
  "impact_statement": "One sentence describing the measurable or professional impact, if inferable. Otherwise an empty string."
}

Guidelines:
- skills: specific technologies, methodologies, tools, or competencies demonstrated (e.g. "PostGIS", "Product Strategy", "REST API design", "Stakeholder Management")
- domains: broad category labels from this set: product, geospatial, backend, frontend, fullstack, ai-ml, qa, data, devops, design, management, support, research, other
- impact_statement: focus on outcomes and value delivered, not just activity
- Be generous with skill extraction — include both technical and soft skills`;

  const raw = await generateResponse(prompt, false, { temperature: 0.2, maxOutputTokens: 2048, jsonMode: true });

  // Parse JSON safely
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      summary: rawText.slice(0, 120),
      skills: [],
      domains: [],
      impact_statement: "",
    };
  }
}

/**
 * Generate a full professional CV from work logs and skill ledger.
 * Returns markdown-formatted CV text.
 */
export async function generateLivingCV(name, domain, logs, skills, contextFilter) {
  const filterNote = contextFilter?.length
    ? `Focus specifically on work done for: ${contextFilter.join(", ")}.`
    : "Include all work contexts (personal, client, and company).";

  const logLines = logs
    .map(l => `[${l.logged_at}] ${l.context_name ? `(${l.context_name}) ` : ""}${l.ai_summary || l.raw_text}${l.impact_statement ? ` — ${l.impact_statement}` : ""}`)
    .join("\n");

  const skillLines = skills
    .map(s => `- ${s.skill} (${s.proficiency_override || s.proficiency_estimate}, last used: ${s.last_seen})`)
    .join("\n");

  const prompt = `You are a world-class CV writer. Generate a professional CV for the following professional.

=== CV NAME ===
${name}

=== DOMAIN / FOCUS ===
${domain || "general"}

=== INSTRUCTION ===
${filterNote}

=== WORK LOG (chronological, most recent first) ===
${logLines || "No logs provided."}

=== SKILL LEDGER ===
${skillLines || "No skills provided."}

=== OUTPUT FORMAT ===
Return a complete, professional CV in clean markdown format. Include:
1. Professional Summary (3-4 sentences, powerful narrative)
2. Core Skills (grouped by domain)
3. Experience (inferred from logs — group by context/employer, use impact statements)
4. Notable Achievements
5. Technical Stack

Be confident and impactful. Do NOT include placeholder sections. Only include what is supported by the data provided.`;

  return generateResponse(prompt, false, { maxOutputTokens: 8192, temperature: 0.6 });
}
