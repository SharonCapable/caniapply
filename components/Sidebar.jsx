"use client";
import { useState } from "react";
import { api } from "@/lib/api-client";

function timeAgo(dateInput) {
    if (!dateInput) return "";
    const date = typeof dateInput === "number" ? new Date(dateInput * 1000) : new Date(dateInput);
    const diff = Math.floor((new Date() - date) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

export default function Sidebar({ sessions, activeId, onSelect, onNew, onDelete, isOpen, onClose }) {
    const [deletingId, setDeletingId] = useState(null);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        setDeletingId(id);
        try {
            await api.deleteSession(id);
            onDelete(id);
        } catch (err) {
            console.error(err);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            {/* Overlay */}
            {isOpen && (
                <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} />
            )}

            {/* Sidebar */}
            <aside style={{
                position: "fixed", top: 0, left: 0, bottom: 0, width: "280px",
                background: "var(--bg2)", borderRight: "1px solid var(--border)",
                zIndex: 50, display: "flex", flexDirection: "column",
                transform: isOpen ? "translateX(0)" : "translateX(-100%)",
                transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
            }}>
                {/* Header */}
                <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.2rem", fontWeight: 600, color: "var(--text-bright)", letterSpacing: "-0.01em" }}>ApplyIQ</span>
                    <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: "1.1rem", lineHeight: 1, cursor: "pointer" }}>✕</button>
                </div>

                {/* New session button */}
                <div style={{ padding: "12px 12px 8px" }}>
                    <button onClick={onNew} style={{
                        width: "100%", padding: "10px", borderRadius: "10px",
                        background: "var(--gold)", color: "#0c0b09", border: "none",
                        fontSize: "0.82rem", fontWeight: 500, display: "flex", alignItems: "center",
                        justifyContent: "center", gap: "6px", cursor: "pointer"
                    }}>
                        + New Application
                    </button>
                </div>

                {/* Sessions list */}
                <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
                    {sessions.length === 0 && (
                        <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-dim)", fontSize: "0.8rem" }}>
                            No applications yet.<br />Start one above.
                        </div>
                    )}
                    {sessions.map((s) => (
                        <div key={s.id} onClick={() => { onSelect(s.id); onClose(); }}
                            style={{
                                padding: "10px 10px", borderRadius: "8px", marginBottom: "2px",
                                cursor: "pointer", display: "flex", alignItems: "flex-start", gap: "8px",
                                background: activeId === s.id ? "var(--bg4)" : "transparent",
                                border: activeId === s.id ? "1px solid var(--border2)" : "1px solid transparent",
                                transition: "all 0.15s",
                            }}
                            onMouseEnter={e => { if (activeId !== s.id) e.currentTarget.style.background = "var(--bg3)"; }}
                            onMouseLeave={e => { if (activeId !== s.id) e.currentTarget.style.background = "transparent"; }}
                        >
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: "0.83rem", color: "var(--text-bright)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {s.title}
                                </div>
                                {s.company_name && (
                                    <div style={{ fontSize: "0.72rem", color: "var(--gold-dim)", marginTop: "2px" }}>{s.company_name}</div>
                                )}
                                <div style={{ fontSize: "0.68rem", color: "var(--text-dim)", marginTop: "2px" }}>
                                    {timeAgo(s.updated_at)}
                                </div>
                            </div>
                            <button
                                onClick={(e) => handleDelete(e, s.id)}
                                disabled={deletingId === s.id}
                                style={{ background: "none", border: "none", color: "var(--text-dim)", opacity: 0, fontSize: "0.8rem", padding: "2px 4px", flexShrink: 0, cursor: "pointer" }}
                                className="delete-btn"
                            >✕</button>
                        </div>
                    ))}
                </div>

                <style jsx="true">{`.delete-btn { transition: opacity 0.15s !important; } div:hover > .delete-btn { opacity: 1 !important; }`}</style>
            </aside>
        </>
    );
}
