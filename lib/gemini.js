const API_KEY = process.env.GEMINI_API_KEY;
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-2.5-flash-lite";

export async function generateResponse(prompt, useSearch = false) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
  };

  if (useSearch) {
    body.tools = [{ google_search: {} }];
  }

  const res = await fetch(`${BASE_URL}/${MODEL}:generateContent?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || `Gemini error ${res.status}`);
  }

  const data = await res.json();
  return (
    data.candidates?.[0]?.content?.parts
      ?.filter((p) => p.text)
      .map((p) => p.text)
      .join("") || "No response generated."
  );
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

  return generateResponse(prompt, true);
}

export function buildCoachContext(cvText, jobDescription, companyInsights) {
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
    }

=== YOUR COACHING STYLE ===
- Direct, practical, and concise
- Gap analysis: highlight only significant gaps, not minor wording differences
- Cover letters: compelling and specific, never generic
- Application questions: craft authentic answers grounded in the CV
- Strategy: actionable steps the candidate can take right now
- Use company insights where relevant for context-aware advice`;
}
