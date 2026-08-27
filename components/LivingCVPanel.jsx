"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";
import Markdown from "@/components/Markdown";

// "general" is not a domain any log is ever tagged with — it means "don't filter".
const DOMAINS = [
  { value: "general", label: "General (all work)" },
  { value: "product", label: "Product" },
  { value: "geospatial", label: "Geospatial" },
  { value: "backend", label: "Backend" },
  { value: "frontend", label: "Frontend" },
  { value: "fullstack", label: "Fullstack" },
  { value: "ai-ml", label: "AI / ML" },
  { value: "qa", label: "QA / Evaluation" },
  { value: "data", label: "Data" },
  { value: "devops", label: "DevOps" },
  { value: "design", label: "Design" },
  { value: "management", label: "Management" },
  { value: "support", label: "Support" },
  { value: "research", label: "Research" },
];

const Btn = ({ children, onClick, variant = "default", disabled, small, type = "button", style: s = {} }) => {
  const base = {
    padding: small ? "6px 12px" : "10px 18px", borderRadius: "10px", border: "none",
    fontSize: small ? "0.76rem" : "0.84rem", fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
    display: "inline-flex", alignItems: "center", gap: "6px", transition: "all 0.15s", ...s,
  };
  const variants = {
    gold: { background: "var(--gold)", color: "#0c0b09" },
    ghost: { background: "transparent", color: "var(--text-dim)", border: "1px solid var(--border2)" },
    danger: { background: "transparent", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" },
    default: { background: "var(--bg4)", color: "var(--text-bright)", border: "1px solid var(--border2)" },
  };
  return (
    <button type={type} style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
};

function CVCard({ cv, onSelect, onDelete, onPin, onRegenerate, selected, selecting }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(cv.generated_text || null);
  const [loadingText, setLoadingText] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const stale = cv.unincorporated_log_count || 0;

  // The list endpoint omits generated_text to stay light — fetch it on demand.
  const ensureText = useCallback(async () => {
    if (text !== null) return text;
    setLoadingText(true);
    try {
      const full = await api.getLivingCV(cv.id);
      setText(full.generated_text);
      return full.generated_text;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoadingText(false);
    }
  }, [cv.id, text]);

  const togglePreview = async () => {
    if (!open) await ensureText();
    setOpen(o => !o);
  };

  const copy = async () => {
    const t = await ensureText();
    if (!t) return;
    await navigator.clipboard.writeText(t);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await onRegenerate(cv.id);
      setText(updated.generated_text);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <div style={{
      background: "var(--bg2)", border: `1px solid ${selected ? "var(--gold)" : "var(--border)"}`,
      borderRadius: "14px", overflow: "hidden", transition: "border-color 0.2s",
    }}>
      <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "180px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
            {cv.is_pinned && <span style={{ fontSize: "0.72rem", color: "var(--gold)" }}>📌</span>}
            <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--text-bright)" }}>{cv.name}</span>
            {cv.domain && (
              <span style={{ fontSize: "0.68rem", padding: "1px 8px", borderRadius: "99px", border: "1px solid var(--border2)", color: "var(--text-dim)" }}>
                {cv.domain}
              </span>
            )}
            {stale > 0 && (
              <span title="Work logged since this CV was written"
                style={{ fontSize: "0.68rem", padding: "1px 8px", borderRadius: "99px", border: "1px solid var(--gold)", color: "var(--gold)", background: "rgba(201,168,76,0.1)" }}>
                {stale} new {stale === 1 ? "entry" : "entries"}
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
            Updated {new Date(cv.last_generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>

        <div style={{ display: "flex", gap: "6px", flexShrink: 0, alignItems: "center" }}>
          <Btn small variant={stale > 0 ? "gold" : "ghost"} onClick={regenerate} disabled={busy}
            style={{ whiteSpace: "nowrap" }}>
            {busy ? "Refreshing…" : "↻ Refresh"}
          </Btn>
          <Btn small variant="ghost" onClick={togglePreview} disabled={loadingText}>
            {loadingText ? "…" : open ? "Hide" : "Preview"}
          </Btn>
          {onSelect && (
            <Btn small variant={selected ? "gold" : "default"} onClick={() => onSelect(cv)} disabled={selecting}>
              {selecting ? "Attaching…" : selected ? "✓ Selected" : "Use this CV"}
            </Btn>
          )}
          <button onClick={() => onPin(cv.id, !cv.is_pinned)} title={cv.is_pinned ? "Unpin" : "Pin"}
            style={{ background: "none", border: "none", color: cv.is_pinned ? "var(--gold)" : "var(--border2)", cursor: "pointer", fontSize: "1rem" }}>
            📌
          </button>
          <button onClick={() => onDelete(cv.id)} title="Delete"
            style={{ background: "none", border: "none", color: "var(--border2)", cursor: "pointer", fontSize: "0.9rem" }}>✕</button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "0 18px 14px", fontSize: "0.78rem", color: "#fca5a5" }}>{error}</div>
      )}

      {open && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "18px" }} className="fade-in">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
            <Btn small variant="ghost" onClick={copy}>{copied ? "Copied!" : "Copy text"}</Btn>
          </div>
          <div style={{
            maxHeight: "400px", overflowY: "auto", background: "var(--bg3)",
            borderRadius: "10px", padding: "16px", border: "1px solid var(--border)",
          }}>
            <Markdown content={text || ""} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @param onSelectCV  when provided, each card offers "Use this CV" (Apply flow)
 * @param compact     drop the page heading when embedded inside another panel
 */
export default function LivingCVPanel({ onSelectCV, compact = false, selectedLivingCvId = null }) {
  const [cvs, setCvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectingId, setSelectingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("general");
  const [contextFilter, setContextFilter] = useState("");
  const [error, setError] = useState(null);

  const loadCVs = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.getLivingCVs();
      setCvs(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => { loadCVs(); }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const filter = contextFilter.split(",").map(s => s.trim()).filter(Boolean);
      const cv = await api.generateLivingCV({ name, domain, context_filter: filter });
      setCvs(prev => [cv, ...prev]);
      setShowForm(false);
      setName("");
      setContextFilter("");
    } catch (err) {
      setError(err.message);
    }
    setGenerating(false);
  };

  const handleRegenerate = async (id) => {
    const updated = await api.regenerateLivingCV(id);
    setCvs(prev => prev.map(c => (c.id === id ? { ...c, ...updated } : c)));
    return updated;
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteLivingCV(id);
      setCvs(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setLoadError(err.message);
    }
  };

  const handlePin = async (id, pinned) => {
    setCvs(prev => prev.map(c => (c.id === id ? { ...c, is_pinned: pinned } : c)));
    try {
      await api.pinLivingCV(id, pinned);
    } catch {
      setCvs(prev => prev.map(c => (c.id === id ? { ...c, is_pinned: !pinned } : c)));
    }
  };

  const handleSelect = async (cv) => {
    if (!onSelectCV) return;
    setSelectingId(cv.id);
    try {
      await onSelectCV(cv);
    } finally {
      setSelectingId(null);
    }
  };

  const inp = {
    width: "100%", background: "var(--bg)", border: "1px solid var(--border2)",
    borderRadius: "10px", padding: "10px 14px", color: "var(--text-bright)",
    fontSize: "0.85rem", outline: "none", fontFamily: "inherit",
  };

  const sorted = [...cvs.filter(c => c.is_pinned), ...cvs.filter(c => !c.is_pinned)];
  const totalStale = cvs.reduce((n, c) => n + (c.unincorporated_log_count || 0), 0);

  return (
    <div style={{ maxWidth: compact ? "none" : "760px", margin: "0 auto", padding: compact ? "0" : "40px 24px" }} className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px", gap: "12px" }}>
        {!compact && (
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.8rem", color: "var(--text-bright)" }}>
            Living CVs
          </h2>
        )}
        <Btn variant="gold" small={compact} onClick={() => setShowForm(f => !f)} style={compact ? { marginLeft: "auto" } : {}}>
          {showForm ? "Cancel" : "+ Generate CV"}
        </Btn>
      </div>

      {!compact && (
        <p style={{ color: "var(--text-dim)", fontSize: "0.84rem", marginBottom: totalStale ? "12px" : "28px" }}>
          Auto-generated from your work logs. Hit ↻ Refresh to fold in everything you have logged since.
        </p>
      )}

      {totalStale > 0 && (
        <div style={{
          background: "rgba(201,168,76,0.06)", border: "1px solid var(--gold-dim)", borderRadius: "10px",
          padding: "10px 14px", marginBottom: "24px", fontSize: "0.8rem", color: "var(--gold)",
        }}>
          You have logged work that none of these CVs mention yet — refresh the ones you plan to send.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleGenerate} className="fade-in"
          style={{ background: "var(--bg2)", border: "1px solid var(--gold-dim)", borderRadius: "14px", padding: "24px", marginBottom: "28px" }}>
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--gold)", marginBottom: "16px" }}>
            ✦ New Living CV
          </div>
          <div style={{ display: "grid", gap: "12px" }}>
            <input style={inp} placeholder="CV name  (e.g. Product Manager CV, Geospatial Specialist)"
              value={name} onChange={e => setName(e.target.value)} required />

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "180px" }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text-dim)", display: "block", marginBottom: "5px" }}>Domain focus</label>
                <select value={domain} onChange={e => setDomain(e.target.value)} style={inp}>
                  {DOMAINS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: "180px" }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text-dim)", display: "block", marginBottom: "5px" }}>
                  Only this client/company <span style={{ color: "var(--border2)" }}>(optional)</span>
                </label>
                <input style={inp} placeholder="AyaData.ai, Client X  (comma-separated)"
                  value={contextFilter} onChange={e => setContextFilter(e.target.value)} />
              </div>
            </div>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "10px 14px", fontSize: "0.82rem", color: "#fca5a5" }}>
                {error}
              </div>
            )}

            <Btn type="submit" variant="gold" disabled={generating || !name.trim()}>
              {generating ? "Generating… (this takes ~15s)" : "Generate CV"}
            </Btn>
          </div>
        </form>
      )}

      {loadError && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "10px 14px", fontSize: "0.82rem", color: "#fca5a5", marginBottom: "16px" }}>
          {loadError}
        </div>
      )}

      {loading && <div className="pulsing" style={{ color: "var(--text-dim)", fontSize: "0.84rem" }}>Loading CVs…</div>}

      {!loading && cvs.length === 0 && !showForm && (
        <div style={{ textAlign: "center", padding: compact ? "24px 0" : "60px 0" }}>
          <div style={{ fontSize: "0.84rem", color: "var(--text-dim)", marginBottom: "16px" }}>
            No living CVs yet. Generate your first one from your work log history.
          </div>
          <Btn variant="gold" onClick={() => setShowForm(true)}>+ Generate your first CV</Btn>
        </div>
      )}

      <div style={{ display: "grid", gap: "10px" }}>
        {sorted.map(cv => (
          <CVCard
            key={cv.id}
            cv={cv}
            selected={selectedLivingCvId === cv.id}
            selecting={selectingId === cv.id}
            onSelect={onSelectCV ? handleSelect : null}
            onDelete={handleDelete}
            onPin={handlePin}
            onRegenerate={handleRegenerate}
          />
        ))}
      </div>
    </div>
  );
}
