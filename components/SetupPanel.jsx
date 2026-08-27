"use client";
import { useState, useRef, useEffect } from "react";

import { api } from "@/lib/api-client";
import LivingCVPanel from "@/components/LivingCVPanel";

const Btn = ({ children, onClick, variant = "default", disabled, style = {} }) => {
    const base = {
        padding: "10px 18px", borderRadius: "10px", border: "none", fontSize: "0.82rem",
        fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s",
        opacity: disabled ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: "6px", ...style
    };
    const variants = {
        gold: { background: "var(--gold)", color: "#0c0b09" },
        ghost: { background: "transparent", color: "var(--text-dim)", border: "1px solid var(--border2)" },
        default: { background: "var(--bg4)", color: "var(--text-bright)", border: "1px solid var(--border2)" },
    };
    return <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>{children}</button>;
};

export default function SetupPanel({ session, onUpdate, onReady }) {
    const [jobInput, setJobInput] = useState(session.job_description || "");
    const [companyInput, setCompanyInput] = useState(session.company_name || "");
    const [jobTitleInput, setJobTitleInput] = useState("");
    const [uploading, setUploading] = useState(false);
    const [researching, setResearching] = useState(false);
    const [suggesting, setSuggesting] = useState(false);
    const [suggestedId, setSuggestedId] = useState(null);
    const [jobConfirmed, setJobConfirmed] = useState(!!session.job_description);
    const [researchError, setResearchError] = useState(null);
    const [cvSource, setCvSource] = useState("upload"); // "upload" | "living"

    useEffect(() => {
        if (session.job_description && !jobConfirmed) setJobConfirmed(true);
    }, [session.job_description]);

    const fileRef = useRef();

    const cvs = session.cvs || [];
    const selectedCvName = session.selected_cv_name;

    const handleUpload = async (e) => {
        const files = Array.from(e.target.files);
        setUploading(true);
        try {
            let currentCvs = [...cvs];
            for (const file of files) {
                const cv = await api.uploadCV(session.id, file);
                if (cv.error) throw new Error(cv.error);

                currentCvs = [...currentCvs, cv];
                onUpdate({ cvs: currentCvs });

                // If no CV is selected, auto-select the first one uploaded
                if (!selectedCvName && !session.selected_cv_name && currentCvs.length === 1) {
                    await selectCV(cv);
                }
            }
        } catch (err) {
            console.error(err);
            alert(err.message);
        }
        setUploading(false);
        e.target.value = "";
    };


    const handleDeleteCV = async (e, cvId) => {
        e.stopPropagation();
        await api.deleteCV(session.id, cvId);
        onUpdate({ cvs: cvs.filter(c => c.id !== cvId) });
    };

    const selectCV = async (cv) => {
        if (!cv) return;
        await api.updateSession(session.id, { selected_cv_name: cv.name });
        onUpdate({ selected_cv_name: cv.name });
    };


    const confirmJob = async () => {
        if (!jobInput.trim()) return;
        const title = jobTitleInput || companyInput || jobInput.slice(0, 40);
        await api.updateSession(session.id, {
            job_description: jobInput,
            company_name: companyInput || null,
            title,
        });
        onUpdate({ job_description: jobInput, company_name: companyInput, title });
        setJobConfirmed(true);

        if (companyInput) {
            setResearching(true);
            try {
                const { insights } = await api.researchCompany(session.id, companyInput, jobTitleInput);
                onUpdate({ company_insights: insights });
            } catch (err) {
                // Research is optional — the application still works without it, but
                // failing silently made it look like the feature simply did nothing.
                setResearchError(err.message);
            }
            setResearching(false);
        }
    };

    const handleSuggestCV = async () => {
        setSuggesting(true);
        setResearchError(null);
        try {
            const { suggested_cv_id, suggested_cv_name } = await api.suggestCV(session.id);
            setSuggestedId(suggested_cv_id);
            onUpdate({ selected_cv_name: suggested_cv_name });
        } catch (err) {
            setResearchError(err.message);
        }
        setSuggesting(false);
    };

    const isReady = cvs.length > 0 && jobConfirmed;


    const s = {
        section: { marginBottom: "32px" },
        label: { fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-dim)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px", fontWeight: 500 },
        input: { width: "100%", background: "var(--bg)", border: "1px solid var(--border2)", borderRadius: "10px", padding: "12px 14px", color: "var(--text-bright)", fontSize: "0.85rem", outline: "none", transition: "border-color 0.2s" },
        card: { background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 18px" },
    };

    return (
        <div style={{ maxWidth: "640px", margin: "0 auto", padding: "40px 24px" }} className="fade-in">
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.8rem", marginBottom: "32px", color: "var(--text-bright)" }}>Setup Application</h2>

            {researchError && (
                <div style={{
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "10px", padding: "10px 14px", marginBottom: "24px",
                    fontSize: "0.8rem", color: "#fca5a5", display: "flex", alignItems: "center", gap: "10px",
                }}>
                    <span style={{ flex: 1 }}>{researchError}</span>
                    <button onClick={() => setResearchError(null)}
                        style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer" }}>✕</button>
                </div>
            )}

            {/* CVs */}
            <div style={s.section}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <div style={s.label}>1. Select Your CV</div>
                    <div style={{ display: "flex", gap: "4px", background: "var(--bg3)", borderRadius: "8px", padding: "3px" }}>
                        {["upload", "living"].map(src => (
                            <button key={src} onClick={() => setCvSource(src)}
                                style={{
                                    padding: "4px 12px", borderRadius: "6px", border: "none",
                                    fontSize: "0.72rem", cursor: "pointer", fontWeight: 500,
                                    background: cvSource === src ? "var(--bg)" : "transparent",
                                    color: cvSource === src ? "var(--text-bright)" : "var(--text-dim)",
                                    transition: "all 0.13s",
                                }}>
                                {src === "upload" ? "⬆ Upload" : "✦ Living CVs"}
                            </button>
                        ))}
                    </div>
                </div>

                {cvSource === "upload" && (
                    <>
                        <div style={{ display: "grid", gap: "8px", marginBottom: "12px" }}>
                            {cvs.map(cv => (
                                <div key={cv.id} onClick={() => selectCV(cv)}
                                    style={{
                                        ...s.card, display: "flex", alignItems: "center", gap: "12px", cursor: "pointer",
                                        borderColor: selectedCvName === cv.name ? "var(--gold)" : "var(--border)",
                                        background: selectedCvName === cv.name ? "var(--bg4)" : "var(--bg3)",
                                        transition: "all 0.2s"
                                    }}>
                                    <div style={{ width: "18px", height: "18px", borderRadius: "50%", border: selectedCvName === cv.name ? "5px solid var(--gold)" : "1px solid var(--border2)", background: "var(--bg)", flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontSize: "0.88rem", color: "var(--text-bright)" }}>{cv.name}</span>
                                    {suggestedId === cv.id && <span style={{ fontSize: "0.68rem", color: "var(--gold)", border: "1px solid var(--gold)", padding: "2px 8px", borderRadius: "99px" }}>Best match</span>}
                                    <button onClick={e => handleDeleteCV(e, cv.id)}
                                        style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: "1rem", cursor: "pointer", padding: "4px" }}>✕</button>
                                </div>
                            ))}
                        </div>

                        <div onClick={() => fileRef.current.click()}
                            style={{ border: "1px dashed var(--border2)", borderRadius: "12px", padding: "24px", textAlign: "center", cursor: "pointer", background: "rgba(255,255,255,0.02)", transition: "all 0.2s" }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = "var(--text-dim)"}
                            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border2)"}>
                            <input ref={fileRef} type="file" accept=".pdf,.txt,.png,.jpg,.jpeg" multiple hidden onChange={handleUpload} />
                            <div style={{ color: uploading ? "var(--gold)" : "var(--text-dim)", fontSize: "0.86rem" }}>
                                {uploading ? "Uploading..." : "↑ Upload CV (PDF, Text, or Image)"}
                            </div>
                        </div>

                        {cvs.length >= 2 && jobConfirmed && (
                            <button onClick={handleSuggestCV} disabled={suggesting}
                                style={{ marginTop: "12px", background: "none", border: "1px solid var(--border2)", color: "var(--gold)", borderRadius: "10px", padding: "10px 16px", fontSize: "0.8rem", cursor: "pointer", fontWeight: 500 }}>
                                {suggesting ? "Analyzing CVs..." : "✦ Auto-suggest best CV for this role"}
                            </button>
                        )}
                    </>
                )}

                {cvSource === "living" && (
                    <LivingCVPanel
                        compact
                        selectedLivingCvId={cvs.find(c => c.name === selectedCvName)?.living_cv_id || null}
                        onSelectCV={async (living) => {
                            // Snapshot the Living CV into this session as a real `cvs` row so the
                            // coach, gap analysis and auto-suggest all read it like any other CV.
                            try {
                                const attached = await api.attachLivingCV(session.id, living.id);
                                const next = [...cvs.filter(c => c.id !== attached.id), attached];
                                onUpdate({ cvs: next, selected_cv_name: attached.name });
                            } catch (err) {
                                alert(err.message);
                            }
                        }}
                    />
                )}
            </div>

            {/* Job Description */}
            <div style={s.section}>
                <div style={s.label}>2. Job Details</div>
                {jobConfirmed ? (
                    <div style={s.card}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ color: "var(--gold)", fontSize: "1rem" }}>✓</span>
                                <span style={{ fontSize: "0.88rem", fontWeight: 500, color: "var(--text-bright)" }}>{session.company_name || "Role details loaded"}</span>
                            </div>
                            <Btn onClick={() => setJobConfirmed(false)} variant="ghost" style={{ padding: "4px 12px", fontSize: "0.75rem" }}>Edit</Btn>
                        </div>
                        <p style={{ fontSize: "0.82rem", color: "var(--text-dim)", whiteSpace: "pre-wrap", maxHeight: "150px", overflow: "hidden", maskImage: "linear-gradient(to bottom, black 70%, transparent 100%)" }}>{session.job_description}</p>
                        {researching && (
                            <div style={{ marginTop: "12px", fontSize: "0.78rem", color: "var(--gold)", display: "flex", alignItems: "center", gap: "8px" }}>
                                <span className="pulsing">⟳</span> Researching {session.company_name}...
                            </div>
                        )}
                        {session.company_insights && !researching && (
                            <div style={{ marginTop: "12px", fontSize: "0.76rem", color: "#a1a1aa", background: "rgba(255,255,255,0.05)", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                                <div style={{ marginBottom: "4px", color: "var(--gold)", fontWeight: 500 }}>Insights Loaded</div>
                                {session.company_insights.slice(0, 100)}...
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ display: "grid", gap: "12px" }}>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <input style={{ ...s.input, flex: 1 }} placeholder="Company" value={companyInput} onChange={e => setCompanyInput(e.target.value)} />
                            <input style={{ ...s.input, flex: 1 }} placeholder="Job Title" value={jobTitleInput} onChange={e => setJobTitleInput(e.target.value)} />
                        </div>
                        <textarea style={{ ...s.input, minHeight: "160px" }}
                            placeholder="Paste the job description here..." value={jobInput} onChange={e => setJobInput(e.target.value)} />
                        <Btn variant="gold" onClick={confirmJob} disabled={!jobInput.trim() || researching}>
                            {researching ? "Confirming..." : "Confirm Role"}
                        </Btn>
                    </div>
                )}
            </div>

            {/* CTA */}
            {isReady && (
                <div style={{ ...s.card, display: "flex", alignItems: "center", gap: "16px", borderColor: "var(--gold-dim)", background: "rgba(201,168,76,0.05)", marginTop: "40px" }} className="fade-in">
                    <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", color: "var(--text-bright)", fontWeight: 600 }}>Coach is ready</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Analyzing with: {selectedCvName || cvs[0]?.name}</div>

                    </div>
                    <Btn variant="gold" onClick={onReady} style={{ padding: "12px 24px", fontSize: "0.88rem" }}>Start Coaching →</Btn>
                </div>
            )}
        </div>
    );
}
