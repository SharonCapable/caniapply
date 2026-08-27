/**
 * Every call goes through `request`, so a non-2xx response throws instead of
 * silently resolving to `{ error: "..." }` and being rendered as data.
 * A 401 means the session expired — bounce to /login rather than showing an empty app.
 */
async function request(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text.slice(0, 200) || `Request failed (${res.status})` };
  }

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  // ── Sessions ──────────────────────────────────────────────
  getSessions: () => request("/api/sessions"),
  getSession: (id) => request(`/api/sessions/${id}`),
  createSession: (title) => request("/api/sessions", json("POST", { title })),
  deleteSession: (id) => request(`/api/sessions/${id}`, { method: "DELETE" }),
  updateSession: (id, patch) => request(`/api/sessions/${id}`, json("PATCH", patch)),

  uploadCV: (sessionId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/api/sessions/${sessionId}/cvs`, { method: "POST", body: formData });
  },
  deleteCV: (sessionId, cvId) =>
    request(`/api/sessions/${sessionId}/cvs/${cvId}`, { method: "DELETE" }),

  sendChatMessage: (sessionId, content) =>
    request(`/api/sessions/${sessionId}/chat`, json("POST", { content })),
  researchCompany: (sessionId, companyName, jobTitle) =>
    request(`/api/sessions/${sessionId}/research`, json("POST", { companyName, jobTitle })),
  suggestCV: (sessionId) =>
    request(`/api/sessions/${sessionId}/suggest-cv`, { method: "POST" }),

  // ── Work Logs ─────────────────────────────────────────────
  getLogs: (filters = {}) => {
    const clean = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== "")
    );
    return request(`/api/logs?${new URLSearchParams(clean)}`);
  },
  createLog: (body) => request("/api/logs", json("POST", body)),
  deleteLog: (id) => request(`/api/logs/${id}`, { method: "DELETE" }),
  /** Retry extraction on an entry that was saved without skills. */
  reextractLog: (id) => request(`/api/logs/${id}/reextract`, { method: "POST" }),

  // ── Skills ────────────────────────────────────────────────
  getSkills: (domain) =>
    request(`/api/skills${domain ? `?domain=${encodeURIComponent(domain)}` : ""}`),
  overrideProficiency: (skill_id, proficiency_override) =>
    request("/api/skills", json("PATCH", { skill_id, proficiency_override })),

  // ── Living CVs ────────────────────────────────────────────
  getLivingCVs: () => request("/api/living-cvs"),
  getLivingCV: (id) => request(`/api/living-cvs/${id}`),
  generateLivingCV: (body) => request("/api/living-cvs", json("POST", body)),
  regenerateLivingCV: (id) => request(`/api/living-cvs/${id}/regenerate`, { method: "POST" }),
  deleteLivingCV: (id) => request(`/api/living-cvs/${id}`, { method: "DELETE" }),
  pinLivingCV: (id, is_pinned) => request(`/api/living-cvs/${id}`, json("PATCH", { is_pinned })),

  /** Snapshot a Living CV into an application session so the coach can read it. */
  attachLivingCV: (sessionId, livingCvId) =>
    request(`/api/sessions/${sessionId}/cvs/from-living`, json("POST", { living_cv_id: livingCvId })),
};
