"use client";
import { useState, useEffect } from "react";
import Logo from "@/components/Logo";
import Sidebar from "@/components/Sidebar";
import SetupPanel from "@/components/SetupPanel";
import ChatPanel from "@/components/ChatPanel";
import WorkLogger from "@/components/WorkLogger";
import SkillDashboard from "@/components/SkillDashboard";
import LivingCVPanel from "@/components/LivingCVPanel";
import { api } from "@/lib/api-client";
import { supabase } from "@/lib/supabase";

const TOP_TABS = [
  { id: "log", label: "📓 Log" },
  { id: "growth", label: "📈 Growth" },
  { id: "apply", label: "✦ Apply" },
];

export default function Home() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [topTab, setTopTab] = useState("apply"); // "log" | "growth" | "apply"
  const [growthSubTab, setGrowthSubTab] = useState("skills"); // "skills" | "cvs"

  // Apply tab state
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [applyTab, setApplyTab] = useState("setup"); // "setup" | "chat"
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (user === null) window.location.href = "/login";
  }, [user]);

  // Load sessions
  useEffect(() => {
    if (user) {
      api.getSessions()
        .then(data => { setSessions(Array.isArray(data) ? data : []); setError(null); })
        .catch(err => setError(err.message));
    }
  }, [user]);

  const loadSession = async (id) => {
    setLoading(true);
    setApplyTab("setup");
    setActiveId(id);
    setTopTab("apply");
    try {
      const s = await api.getSession(id);
      setActiveSession(s);
      setError(null);
    } catch (err) {
      setError(err.message);
      setActiveId(null);
      setActiveSession(null);
    }
    setLoading(false);
  };

  const createSession = async () => {
    try {
      const s = await api.createSession("New Application");
      setSessions(prev => [s, ...prev]);
      await loadSession(s.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteSession = (id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeId === id) { setActiveId(null); setActiveSession(null); }
  };

  const updateSession = (patch) => {
    setActiveSession(prev => ({ ...prev, ...patch }));
    api.getSessions().then(setSessions).catch(() => { });
  };

  // Auto-select first CV
  useEffect(() => {
    if (activeSession && activeSession.cvs?.length === 1 && !activeSession.selected_cv_name) {
      const name = activeSession.cvs[0].name;
      updateSession({ selected_cv_name: name });
      api.updateSession(activeSession.id, { selected_cv_name: name });
    }
  }, [activeSession?.id, activeSession?.cvs?.length, activeSession?.selected_cv_name]);

  const isReady = !!(activeSession?.cvs?.length && activeSession?.job_description);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  // Show blank screen while checking auth
  if (user === undefined) return null;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden" }}>
      {/* Sidebar (only relevant for Apply tab) */}
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
        {/* Hamburger (only show in Apply tab) */}
        {topTab === "apply" && (
          <button onClick={() => setSidebarOpen(true)}
            style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: "5px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ display: "block", width: "18px", height: "1.5px", background: "currentColor" }} />
            <span style={{ display: "block", width: "14px", height: "1.5px", background: "currentColor" }} />
            <span style={{ display: "block", width: "18px", height: "1.5px", background: "currentColor" }} />
          </button>
        )}

        <Logo size="sm" />

        {/* Current session name (Apply tab only) */}
        {topTab === "apply" && activeSession && (
          <>
            <span style={{ color: "var(--border2)", fontSize: "1rem" }}>·</span>
            <span style={{ fontSize: "0.78rem", color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>
              {activeSession.title}
            </span>
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Top nav tabs */}
        <div style={{ display: "flex", gap: "1px", background: "var(--bg3)", borderRadius: "8px", padding: "3px" }}>
          {TOP_TABS.map(t => (
            <button key={t.id} onClick={() => setTopTab(t.id)}
              style={{
                padding: "5px 14px", borderRadius: "6px", border: "none", fontSize: "0.76rem",
                cursor: "pointer",
                background: topTab === t.id ? "var(--bg)" : "transparent",
                color: topTab === t.id ? "var(--text-bright)" : "var(--text-dim)",
                transition: "all 0.13s",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Apply sub-tabs (only when in Apply and session is active) */}
        {topTab === "apply" && activeSession && (
          <div style={{ display: "flex", gap: "1px", background: "var(--bg3)", borderRadius: "8px", padding: "3px", marginLeft: "8px" }}>
            {[{ id: "setup", label: "⚙ Setup" }, { id: "chat", label: "✦ Coach" }].map(t => (
              <button key={t.id}
                onClick={() => { if (t.id === "chat" && !isReady) return; setApplyTab(t.id); }}
                style={{
                  padding: "5px 14px", borderRadius: "6px", border: "none", fontSize: "0.76rem",
                  cursor: t.id === "chat" && !isReady ? "not-allowed" : "pointer",
                  background: applyTab === t.id ? "var(--bg)" : "transparent",
                  color: applyTab === t.id ? "var(--text-bright)" : "var(--text-dim)",
                  opacity: t.id === "chat" && !isReady ? 0.4 : 1,
                  transition: "all 0.13s",
                }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* User menu */}
        {user && (
          <button onClick={handleSignOut} title="Sign out"
            style={{ background: "none", border: "1px solid var(--border2)", color: "var(--text-dim)", borderRadius: "8px", padding: "5px 10px", fontSize: "0.72rem", cursor: "pointer" }}>
            Sign out
          </button>
        )}
      </header>

      {error && (
        <div style={{
          flexShrink: 0, background: "rgba(239,68,68,0.1)", borderBottom: "1px solid rgba(239,68,68,0.3)",
          padding: "8px 18px", fontSize: "0.78rem", color: "#fca5a5",
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)}
            style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Body */}
      <main style={{ flex: 1, overflow: "hidden", display: "flex", minHeight: 0 }}>

        {/* ── LOG TAB ── */}
        {topTab === "log" && (
          <div style={{ flex: 1, overflowY: "auto" }} className="fade-in">
            <WorkLogger />
          </div>
        )}

        {/* ── GROWTH TAB ── */}
        {topTab === "growth" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }} className="fade-in">
            {/* Growth sub-tabs */}
            <div style={{ borderBottom: "1px solid var(--border)", padding: "10px 24px", display: "flex", gap: "4px", background: "var(--bg2)", flexShrink: 0 }}>
              {[{ id: "skills", label: "📈 Skills" }, { id: "cvs", label: "📄 Living CVs" }].map(t => (
                <button key={t.id} onClick={() => setGrowthSubTab(t.id)}
                  style={{
                    padding: "6px 16px", borderRadius: "8px", border: "none", fontSize: "0.8rem",
                    cursor: "pointer", fontWeight: 500,
                    background: growthSubTab === t.id ? "var(--bg4)" : "transparent",
                    color: growthSubTab === t.id ? "var(--text-bright)" : "var(--text-dim)",
                    transition: "all 0.13s",
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {growthSubTab === "skills" && <SkillDashboard />}
              {growthSubTab === "cvs" && <LivingCVPanel />}
            </div>
          </div>
        )}

        {/* ── APPLY TAB ── */}
        {topTab === "apply" && (
          <>
            {!activeSession && !loading && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }} className="fade-in">
                <Logo size="lg" />
                <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", textAlign: "center", maxWidth: "300px", lineHeight: 1.7 }}>
                  Your AI-powered career coach. Upload your CVs or use a Living CV, paste a job description, and get tailored advice for every application.
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
                {applyTab === "setup" && (
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    <SetupPanel session={activeSession} onUpdate={updateSession} onReady={() => setApplyTab("chat")} />
                  </div>
                )}
                {applyTab === "chat" && isReady && (
                  <ChatPanel session={activeSession} onUpdate={updateSession} />
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
