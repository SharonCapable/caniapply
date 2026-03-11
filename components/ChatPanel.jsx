"use client";
import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api-client";
import Markdown from "@/components/Markdown";

const QUICK_ACTIONS = [
    { label: "📋 Strategy", prompt: "Give me a concise application strategy for this role based on my CV." },
    { label: "✍️ Cover letter", prompt: "Write a compelling, tailored cover letter for this role using my CV." },
    { label: "🔍 Gap analysis", prompt: "Highlight the main gaps between my CV and this job description. Keep it high-level — just the meaningful ones." },
    { label: "🏢 Company brief", prompt: "Based on the company research, give me a quick brief on what to know before applying." },
];

export default function ChatPanel({ session, onUpdate }) {
    const [messages, setMessages] = useState(session.messages || []);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const endRef = useRef();
    const textareaRef = useRef();

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    const selectedCv = session.cvs?.find(c => c.name === session.selected_cv_name);

    const send = async (text) => {
        const msg = text || input.trim();
        if (!msg || loading || !selectedCv) return;

        setInput("");
        const userMsg = { role: "user", content: msg, created_at: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);

        try {
            const { reply } = await api.sendChatMessage(session.id, msg);
            setMessages(prev => [...prev, { role: "assistant", content: reply, created_at: new Date().toISOString() }]);
            onUpdate({}); // Trigger refresh if needed
        } catch (err) {
            setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${err.message}`, created_at: new Date().toISOString() }]);
        }
        setLoading(false);
    };

    const handleKey = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    };

    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }} className="fade-in">
            {/* Quick actions */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: "8px", flexWrap: "wrap", background: "var(--bg2)" }}>
                {QUICK_ACTIONS.map(a => (
                    <button key={a.label} onClick={() => send(a.prompt)}
                        style={{
                            padding: "7px 14px", borderRadius: "99px", border: "1px solid var(--border2)",
                            background: "var(--bg3)", color: "var(--text-dim)", fontSize: "0.76rem",
                            cursor: "pointer", transition: "all 0.15s", fontWeight: 500
                        }}
                        onMouseEnter={e => { e.target.style.color = "var(--text-bright)"; e.target.style.borderColor = "var(--gold-dim)"; e.target.style.background = "var(--bg4)"; }}
                        onMouseLeave={e => { e.target.style.color = "var(--text-dim)"; e.target.style.background = "var(--bg3)"; e.target.style.borderColor = "var(--border2)"; }}>
                        {a.label}
                    </button>
                ))}
                <div style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--text-dim)", alignSelf: "center", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--gold)" }}></span>
                    CV: <span style={{ color: "var(--text-bright)", fontWeight: 500 }}>{session.selected_cv_name}</span>
                </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)" }} className="fade-in">
                        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.25rem", color: "var(--text-bright)", marginBottom: "10px", fontWeight: 600 }}>
                            Your coach is ready
                        </div>
                        <div style={{ fontSize: "0.82rem", lineHeight: 1.6, maxWidth: "300px", margin: "0 auto" }}>
                            Use the quick actions above or ask anything about this application
                        </div>
                    </div>
                )}

                {messages.map((m, i) => (
                    <div key={i} style={{
                        maxWidth: m.role === "user" ? "80%" : "95%",
                        alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                        padding: "14px 18px",
                        borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        background: m.role === "user" ? "var(--bg4)" : "var(--bg3)",
                        border: `1px solid ${m.role === "user" ? "var(--border2)" : "var(--border)"}`,
                        fontSize: "0.88rem",
                        lineHeight: 1.6,
                        color: "var(--text-bright)"
                    }} className="fade-in">
                        {m.role === "assistant" ? <Markdown text={m.content} /> : <span>{m.content}</span>}
                    </div>
                ))}

                {loading && (
                    <div style={{ alignSelf: "flex-start", padding: "14px 18px", borderRadius: "18px 18px 18px 4px", background: "var(--bg3)", border: "1px solid var(--border)" }}>
                        <span style={{ color: "var(--gold)", fontSize: "0.85rem" }} className="pulsing">✦ Coach is thinking...</span>
                    </div>
                )}
                <div ref={endRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: "12px", alignItems: "flex-end", background: "var(--bg2)" }}>
                <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
                    placeholder={`Ask about this application...`}
                    rows={1}
                    style={{
                        flex: 1, background: "var(--bg)", border: "1px solid var(--border2)", borderRadius: "12px",
                        padding: "12px 16px", color: "var(--text-bright)", fontSize: "0.88rem", outline: "none",
                        minHeight: "46px", maxHeight: "150px", resize: "none", lineHeight: "1.5", transition: "border-color 0.2s"
                    }}
                    onFocus={e => e.target.style.borderColor = "var(--gold-dim)"}
                    onBlur={e => e.target.style.borderColor = "var(--border2)"} />
                <button onClick={() => send()} disabled={loading || !input.trim()}
                    style={{
                        width: "46px", height: "46px", borderRadius: "12px", border: "none",
                        background: input.trim() ? "var(--gold)" : "var(--bg4)", color: input.trim() ? "#0c0b09" : "var(--text-dim)",
                        cursor: input.trim() ? "pointer" : "not-allowed", transition: "all 0.2s", flexShrink: 0,
                        fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center"
                    }}>↑</button>
            </div>
        </div>
    );
}
