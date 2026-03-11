"use client";
import { useState, useEffect } from "react";
import Logo from "@/components/Logo";
import Sidebar from "@/components/Sidebar";
import SetupPanel from "@/components/SetupPanel";
import ChatPanel from "@/components/ChatPanel";
import { api } from "@/lib/api-client";

export default function Home() {
  const [sessions,       setSessions]       = useState([]);
  const [activeId,       setActiveId]       = useState(null);
  const [activeSession,  setActiveSession]  = useState(null);
  const [tab,            setTab]            = useState("setup");
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [loading,        setLoading]        = useState(false);

  useEffect(() => {
    api.getSessions().then(setSessions).catch(console.error);
  }, []);

  const loadSession = async (id) => {
    setLoading(true);
    setTab("setup");
    setActiveId(id);
    try {
      const s = await api.getSession(id);
      setActiveSession(s);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const createSession = async () => {
    const s = await api.createSession("New Application");
    setSessions(prev => [s, ...prev]);
    await loadSession(s.id);
  };

  const deleteSession = (id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeId === id) { setActiveId(null); setActiveSession(null); }
  };

  const updateSession = (patch) => {
    setActiveSession(prev => ({ ...prev, ...patch }));
    api.getSessions().then(setSessions).catch(() => {});
  };

  const isReady = !!(activeSession?.cvs?.length && activeSession?.selected_cv_name && activeSession?.job_description);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden" }}>
      <Sidebar
        sessions={sessions} activeId={activeId}
        onSelect={loadSession} onNew={createSession} onDelete={deleteSession}
        isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
      />

      {/* Header */}
      <header style={{
        height: "50px", flexShrink: 0, display: "flex", alignItems: "center", gap: "12px",
        padding: "0 18px", borderBottom: "1px solid var(--border)", background: "var(--bg2)",
      }}>
        {/* Hamburger */}
        <button onClick={() => setSidebarOpen(true)}
          style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: "5px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ display: "block", width: "18px", height: "1.5px", background: "currentColor" }} />
          <span style={{ display: "block", width: "14px", height: "1.5px", background: "currentColor" }} />
          <span style={{ display: "block", width: "18px", height: "1.5px", background: "currentColor" }} />
        </button>

        <Logo size="sm" />

        {activeSession && (
          <>
            <span style={{ color: "var(--border2)", fontSize: "1rem" }}>·</span>
            <span style={{ fontSize: "0.78rem", color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>{activeSession.title}</span>
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Tabs */}
        {activeSession && (
          <div style={{ display: "flex", gap: "1px", background: "var(--bg3)", borderRadius: "8px", padding: "3px" }}>
            {["setup", "chat"].map(t => (
              <button key={t}
                onClick={() => { if (t === "chat" && !isReady) return; setTab(t); }}
                style={{
                  padding: "5px 14px", borderRadius: "6px", border: "none", fontSize: "0.76rem",
                  cursor: t === "chat" && !isReady ? "not-allowed" : "pointer",
                  background: tab === t ? "var(--bg)" : "transparent",
                  color: tab === t ? "var(--text-bright)" : "var(--text-dim)",
                  opacity: t === "chat" && !isReady ? 0.4 : 1,
                  transition: "all 0.13s",
                }}>
                {t === "setup" ? "⚙ Setup" : "✦ Coach"}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Body */}
      <main style={{ flex: 1, overflow: "hidden", display: "flex", minHeight: 0 }}>
        {!activeSession && !loading && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }} className="fade-in">
            <Logo size="lg" />
            <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", textAlign: "center", maxWidth: "300px", lineHeight: 1.7 }}>
              Your AI-powered career coach. Upload your CVs, paste a job description, and get tailored advice for every application.
            </p>
            <button onClick={createSession}
              style={{ padding: "11px 28px", background: "var(--gold)", color: "#0c0b09", border: "none", borderRadius: "10px", fontSize: "0.86rem", fontWeight: 500, cursor: "pointer" }}>
              Start New Application
            </button>
          </div>
        )}

        {loading && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="pulsing" style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>Loading…</span>
          </div>
        )}

        {activeSession && !loading && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            {tab === "setup" && (
              <div style={{ flex: 1, overflowY: "auto" }}>
                <SetupPanel session={activeSession} onUpdate={updateSession} onReady={() => setTab("chat")} />
              </div>
            )}
            {tab === "chat" && isReady && (
              <ChatPanel session={activeSession} onUpdate={updateSession} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
