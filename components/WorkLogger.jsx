"use client";
import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api-client";

const CONTEXT_TYPES = ["personal", "client", "company"];
const Tag = ({ children, color = "var(--gold)" }) => (
  <span style={{
    display: "inline-block", padding: "2px 10px", borderRadius: "99px",
    fontSize: "0.72rem", border: `1px solid ${color}`, color,
    background: "transparent", whiteSpace: "nowrap",
  }}>{children}</span>
);

const Btn = ({ children, onClick, variant = "default", disabled, small, style: s = {} }) => {
  const base = {
    padding: small ? "6px 14px" : "10px 18px", borderRadius: "10px", border: "none",
    fontSize: small ? "0.78rem" : "0.84rem", fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
    display: "inline-flex", alignItems: "center", gap: "6px", transition: "all 0.15s", ...s,
  };
  const variants = {
    gold: { background: "var(--gold)", color: "#0c0b09" },
    ghost: { background: "transparent", color: "var(--text-dim)", border: "1px solid var(--border2)" },
    danger: { background: "transparent", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" },
    default: { background: "var(--bg4)", color: "var(--text-bright)", border: "1px solid var(--border2)" },
  };
  return <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>{children}</button>;
};

export default function WorkLogger() {
  const [logs, setLogs] = useState([]);
  const [rawText, setRawText] = useState("");
  const [contextType, setContextType] = useState("personal");
  const [contextName, setContextName] = useState("");
  const [loggedAt, setLoggedAt] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(null); // AI extraction result
  const [listening, setListening] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [filterContext, setFilterContext] = useState("");
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  // Load recent logs
  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await api.getLogs({ limit: 30 });
      setLogs(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
    setLoadingLogs(false);
  };

  useEffect(() => { loadLogs(); }, []);

  // Voice recording
  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in your browser. Try Chrome or Edge.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    let finalTranscript = rawText;

    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      setRawText(finalTranscript + interim);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const handleSubmit = async () => {
    if (!rawText.trim()) return;
    // Stop the mic first so a running transcript cannot overwrite the cleared box.
    if (listening) { recognitionRef.current?.stop(); setListening(false); }
    setSubmitting(true);
    setPreview(null);
    setError(null);
    try {
      const result = await api.createLog({
        raw_text: rawText,
        context_type: contextType,
        context_name: contextType !== "personal" ? contextName : null,
        logged_at: loggedAt,
      });
      setPreview(result.extracted);
      if (result.warning) setError(result.warning);
      setRawText("");
      await loadLogs();
    } catch (err) {
      setError(err.message);
    }
    setSubmitting(false);
  };

  const [reextracting, setReextracting] = useState(null);

  const handleReextract = async (id) => {
    setReextracting(id);
    setError(null);
    try {
      const { log } = await api.reextractLog(id);
      setLogs(prev => prev.map(l => (l.id === id ? log : l)));
    } catch (err) {
      setError(err.message);
    }
    setReextracting(null);
  };

  const handleDelete = async (id) => {
    const prev = logs;
    setLogs(l => l.filter(x => x.id !== id));
    try {
      await api.deleteLog(id);
    } catch (err) {
      setLogs(prev);
      setError(err.message);
    }
  };

  const filtered = filterContext ? logs.filter(l => l.context_type === filterContext) : logs;

  const inp = {
    width: "100%", background: "var(--bg)", border: "1px solid var(--border2)",
    borderRadius: "10px", padding: "10px 14px", color: "var(--text-bright)",
    fontSize: "0.85rem", outline: "none", fontFamily: "inherit",
  };

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "40px 24px" }} className="fade-in">
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.8rem", marginBottom: "6px", color: "var(--text-bright)" }}>
        Work Log
      </h2>
      <p style={{ color: "var(--text-dim)", fontSize: "0.84rem", marginBottom: "32px" }}>
        Log what you did today. The AI will extract your skills and keep your CVs current.
      </p>

      {/* === Logger Form === */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "16px", padding: "24px", marginBottom: "32px" }}>

        {/* Context row */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "4px" }}>
            {CONTEXT_TYPES.map(ct => (
              <button key={ct} onClick={() => setContextType(ct)}
                style={{
                  padding: "6px 14px", borderRadius: "8px", border: "1px solid",
                  fontSize: "0.78rem", cursor: "pointer", fontWeight: 500, transition: "all 0.15s",
                  borderColor: contextType === ct ? "var(--gold)" : "var(--border2)",
                  background: contextType === ct ? "rgba(201,168,76,0.1)" : "transparent",
                  color: contextType === ct ? "var(--gold)" : "var(--text-dim)",
                }}>
                {ct.charAt(0).toUpperCase() + ct.slice(1)}
              </button>
            ))}
          </div>

          {contextType !== "personal" && (
            <input
              style={{ ...inp, flex: 1, minWidth: "160px" }}
              placeholder={contextType === "client" ? "Client name (e.g. AyaData.ai)" : "Company name"}
              value={contextName}
              onChange={e => setContextName(e.target.value)}
            />
          )}

          <input type="date" value={loggedAt} onChange={e => setLoggedAt(e.target.value)}
            style={{ ...inp, width: "auto", minWidth: "140px" }} />
        </div>

        {/* Text area */}
        <div style={{ position: "relative" }}>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            placeholder="What did you work on today? Be specific — tools, outcomes, what you built or solved..."
            style={{ ...inp, minHeight: "120px", paddingRight: "48px", resize: "vertical" }}
          />
          {/* Voice button */}
          <button onClick={toggleVoice}
            title={listening ? "Stop recording" : "Start voice input"}
            style={{
              position: "absolute", top: "10px", right: "10px",
              background: listening ? "rgba(239,68,68,0.15)" : "var(--bg4)",
              border: `1px solid ${listening ? "#f87171" : "var(--border2)"}`,
              borderRadius: "8px", width: "34px", height: "34px",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: "1rem", transition: "all 0.2s",
              color: listening ? "#f87171" : "var(--text-dim)",
            }}>
            {listening ? "⏹" : "🎙️"}
          </button>
        </div>
        {listening && (
          <div className="pulsing" style={{ fontSize: "0.75rem", color: "#f87171", marginTop: "6px" }}>
            Recording… speak naturally, then click stop when done.
          </div>
        )}

        {error && (
          <div style={{
            marginTop: "12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "8px", padding: "10px 14px", fontSize: "0.8rem", color: "#fca5a5",
          }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "12px", marginTop: "14px" }}>
          {contextType !== "personal" && !contextName.trim() && (
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
              Name the {contextType} so it can be grouped on your CV.
            </span>
          )}
          <Btn variant="gold" onClick={handleSubmit}
            disabled={submitting || !rawText.trim() || (contextType !== "personal" && !contextName.trim())}>
            {submitting ? "Processing…" : "✦ Log & Extract Skills"}
          </Btn>
        </div>
      </div>

      {/* === AI Preview Card === */}
      {preview && (
        <div className="fade-in" style={{
          background: "rgba(201,168,76,0.06)", border: "1px solid var(--gold-dim)",
          borderRadius: "14px", padding: "20px", marginBottom: "32px",
        }}>
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--gold)", marginBottom: "12px" }}>
            ✦ Skills Extracted
          </div>
          {preview.summary && (
            <p style={{ fontSize: "0.88rem", color: "var(--text-bright)", marginBottom: "12px", lineHeight: 1.6 }}>
              {preview.summary}
            </p>
          )}
          {preview.impact_statement && (
            <p style={{ fontSize: "0.82rem", color: "var(--text-dim)", fontStyle: "italic", marginBottom: "14px" }}>
              → {preview.impact_statement}
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {(preview.skills || []).map(s => <Tag key={s}>{s}</Tag>)}
            {(preview.domains || []).map(d => <Tag key={d} color="#60a5fa">{d}</Tag>)}
          </div>
        </div>
      )}

      {/* === Log Feed === */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-dim)", fontWeight: 500 }}>
            Recent Entries
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            {["", ...CONTEXT_TYPES].map(ct => (
              <button key={ct || "all"} onClick={() => setFilterContext(ct)}
                style={{
                  padding: "4px 10px", borderRadius: "6px", border: "1px solid",
                  fontSize: "0.72rem", cursor: "pointer",
                  borderColor: filterContext === ct ? "var(--border2)" : "transparent",
                  background: filterContext === ct ? "var(--bg4)" : "transparent",
                  color: filterContext === ct ? "var(--text-bright)" : "var(--text-dim)",
                }}>
                {ct || "All"}
              </button>
            ))}
          </div>
        </div>

        {loadingLogs && <div style={{ color: "var(--text-dim)", fontSize: "0.84rem" }} className="pulsing">Loading…</div>}

        {!loadingLogs && filtered.length === 0 && (
          <div style={{ color: "var(--text-dim)", fontSize: "0.84rem", textAlign: "center", padding: "40px 0" }}>
            No entries yet. Log your first work entry above.
          </div>
        )}

        <div style={{ display: "grid", gap: "10px" }}>
          {filtered.map(log => (
            <div key={log.id} style={{
              background: "var(--bg2)", border: "1px solid var(--border)",
              borderRadius: "12px", padding: "16px 18px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{log.logged_at}</span>
                  <span style={{
                    fontSize: "0.68rem", padding: "1px 8px", borderRadius: "99px",
                    border: "1px solid var(--border2)", color: "var(--text-dim)",
                  }}>{log.context_type || "personal"}{log.context_name ? ` · ${log.context_name}` : ""}</span>
                </div>
                <button onClick={() => handleDelete(log.id)}
                  style={{ background: "none", border: "none", color: "var(--border2)", cursor: "pointer", fontSize: "0.9rem", padding: "0 2px" }}>✕</button>
              </div>
              <p style={{ fontSize: "0.86rem", color: "var(--text-bright)", marginBottom: "10px", lineHeight: 1.6 }}>
                {log.ai_summary || log.raw_text}
              </p>
              {log.impact_statement && (
                <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", fontStyle: "italic", marginBottom: "10px" }}>
                  → {log.impact_statement}
                </p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
                {(log.skills_extracted || []).map(s => <Tag key={s}>{s}</Tag>)}
                {(log.domains || []).map(d => <Tag key={d} color="#60a5fa">{d}</Tag>)}
                {!(log.skills_extracted || []).length && (
                  <>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                      No skills extracted.
                    </span>
                    <Btn small variant="ghost" onClick={() => handleReextract(log.id)}
                      disabled={reextracting === log.id}>
                      {reextracting === log.id ? "Extracting…" : "↻ Retry extraction"}
                    </Btn>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
