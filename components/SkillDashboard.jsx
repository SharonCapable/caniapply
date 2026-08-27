"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";

const DOMAIN_COLORS = {
  product: "#c9a84c",
  geospatial: "#34d399",
  backend: "#60a5fa",
  frontend: "#a78bfa",
  fullstack: "#818cf8",
  "ai-ml": "#f472b6",
  qa: "#fb923c",
  data: "#38bdf8",
  devops: "#4ade80",
  design: "#e879f9",
  management: "#fbbf24",
  support: "#94a3b8",
  research: "#67e8f9",
  other: "#71717a",
};

const PROFICIENCY_LEVELS = ["beginner", "intermediate", "advanced", "expert"];

const PROFICIENCY_COLORS = {
  beginner: "#60a5fa",
  intermediate: "#34d399",
  advanced: "#c9a84c",
  expert: "#f472b6",
};

function daysSince(dateStr) {
  if (!dateStr) return 999;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

function RecencyBar({ days }) {
  const pct = Math.max(0, Math.min(100, 100 - (days / 180) * 100));
  const color = days <= 7 ? "#34d399" : days <= 30 ? "#c9a84c" : days <= 90 ? "#fb923c" : "#71717a";
  return (
    <div style={{ flex: 1, height: "4px", background: "var(--bg4)", borderRadius: "2px", overflow: "hidden", minWidth: "60px" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "2px", transition: "width 0.4s" }} />
    </div>
  );
}

function SkillRow({ skill, onOverride }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(skill.proficiency_override || skill.proficiency_estimate || "intermediate");
  const [saving, setSaving] = useState(false);
  const days = daysSince(skill.last_seen);
  const displayProficiency = skill.proficiency_override || skill.proficiency_estimate || "intermediate";
  const domainColor = DOMAIN_COLORS[skill.domain] || DOMAIN_COLORS.other;

  const save = async () => {
    setSaving(true);
    await onOverride(skill.id, value);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px",
      borderRadius: "10px", background: "var(--bg2)", border: "1px solid var(--border)",
    }}>
      {/* Skill name */}
      <div style={{ flex: "0 0 160px", fontSize: "0.86rem", color: "var(--text-bright)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {skill.skill}
      </div>

      {/* Domain badge */}
      <div style={{ flex: "0 0 90px" }}>
        <span style={{
          fontSize: "0.68rem", padding: "2px 8px", borderRadius: "99px",
          border: `1px solid ${domainColor}40`, color: domainColor, background: `${domainColor}10`,
        }}>{skill.domain || "other"}</span>
      </div>

      {/* Recency bar */}
      <RecencyBar days={days} />

      {/* Recency label */}
      <div style={{ flex: "0 0 80px", fontSize: "0.72rem", color: "var(--text-dim)", textAlign: "right" }}>
        {days <= 1 ? "today" : days <= 7 ? `${days}d ago` : days <= 30 ? `${Math.round(days / 7)}w ago` : `${Math.round(days / 30)}mo ago`}
      </div>

      {/* Proficiency badge + edit */}
      <div style={{ flex: "0 0 120px", display: "flex", alignItems: "center", gap: "6px" }}>
        {editing ? (
          <>
            <select value={value} onChange={e => setValue(e.target.value)}
              style={{ background: "var(--bg4)", border: "1px solid var(--border2)", borderRadius: "6px", color: "var(--text-bright)", fontSize: "0.72rem", padding: "3px 6px", flex: 1 }}>
              {PROFICIENCY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <button onClick={save} disabled={saving}
              style={{ background: "var(--gold)", border: "none", borderRadius: "5px", color: "#0c0b09", fontSize: "0.68rem", padding: "3px 7px", cursor: "pointer" }}>
              {saving ? "…" : "✓"}
            </button>
            <button onClick={() => setEditing(false)}
              style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: "0.72rem", cursor: "pointer" }}>✕</button>
          </>
        ) : (
          <>
            <span style={{
              fontSize: "0.72rem", padding: "2px 8px", borderRadius: "99px",
              border: `1px solid ${PROFICIENCY_COLORS[displayProficiency]}40`,
              color: PROFICIENCY_COLORS[displayProficiency],
              background: `${PROFICIENCY_COLORS[displayProficiency]}10`,
            }}>
              {displayProficiency}
              {skill.proficiency_override ? " ✎" : ""}
            </span>
            <button onClick={() => setEditing(true)}
              title="Override proficiency"
              style={{ background: "none", border: "none", color: "var(--border2)", cursor: "pointer", fontSize: "0.8rem", padding: "0 2px" }}>✎</button>
          </>
        )}
      </div>

      {/* Count */}
      <div style={{ flex: "0 0 40px", fontSize: "0.72rem", color: "var(--text-dim)", textAlign: "right" }}>
        ×{skill.occurrence_count}
      </div>
    </div>
  );
}

export default function SkillDashboard() {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDomain, setActiveDomain] = useState("all");

  const [error, setError] = useState(null);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const data = await api.getSkills();
      setSkills(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => { loadSkills(); }, []);

  const handleOverride = async (skillId, value) => {
    const prev = skills;
    setSkills(s => s.map(x => x.id === skillId ? { ...x, proficiency_override: value || null } : x));
    try {
      await api.overrideProficiency(skillId, value || null);
    } catch (err) {
      setSkills(prev);
      setError(err.message);
    }
  };

  // A skill can belong to several domains (product AND geospatial) — match any of them.
  const skillDomains = (s) => (Array.isArray(s.domains) && s.domains.length ? s.domains : [s.domain || "other"]);
  const domains = ["all", ...Array.from(new Set(skills.flatMap(skillDomains))).sort()];
  const filtered = activeDomain === "all" ? skills : skills.filter(s => skillDomains(s).includes(activeDomain));

  // Stats
  const activeThisMonth = skills.filter(s => daysSince(s.last_seen) <= 30).length;
  const growingFast = skills.filter(s => s.occurrence_count >= 3 && daysSince(s.last_seen) <= 14);
  const fading = skills.filter(s => daysSince(s.last_seen) > 90);

  // New skills acquired per month over the last 6 months — the "am I actually
  // growing or on repeat?" signal.
  const trend = (() => {
    const now = new Date();
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-GB", { month: "short" }),
        count: 0,
      });
    }
    const index = new Map(buckets.map(b => [b.key, b]));
    for (const s of skills) {
      if (!s.first_seen) continue;
      const bucket = index.get(String(s.first_seen).slice(0, 7));
      if (bucket) bucket.count += 1;
    }
    return buckets;
  })();
  const trendMax = Math.max(1, ...trend.map(b => b.count));
  const hasTrend = trend.some(b => b.count > 0);

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 24px" }} className="fade-in">
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.8rem", marginBottom: "6px", color: "var(--text-bright)" }}>
        Skill Growth
      </h2>
      <p style={{ color: "var(--text-dim)", fontSize: "0.84rem", marginBottom: "28px" }}>
        Built from your work logs. Click ✎ on any skill to override the proficiency estimate.
      </p>

      {/* Stats row */}
      {!loading && skills.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "28px" }}>
          {[
            { label: "Total Skills", value: skills.length, color: "var(--text-bright)" },
            { label: "Active this month", value: activeThisMonth, color: "#34d399" },
            { label: "Growing fast", value: growingFast.length, color: "#c9a84c" },
          ].map(stat => (
            <div key={stat.label} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 18px" }}>
              <div style={{ fontSize: "1.6rem", fontFamily: "var(--font-display)", color: stat.color, fontWeight: 600 }}>{stat.value}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "2px" }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* New-skills-per-month trend */}
      {!loading && hasTrend && (
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 18px", marginBottom: "24px" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "14px" }}>
            New skills per month
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", height: "72px" }}>
            {trend.map(b => (
              <div key={b.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", height: "100%", justifyContent: "flex-end" }}>
                <span style={{ fontSize: "0.7rem", color: b.count ? "var(--gold)" : "var(--border2)" }}>{b.count}</span>
                <div title={`${b.count} new in ${b.label}`}
                  style={{
                    width: "100%", maxWidth: "44px", borderRadius: "4px 4px 0 0",
                    height: `${Math.max(3, (b.count / trendMax) * 46)}px`,
                    background: b.count ? "var(--gold)" : "var(--bg4)",
                    transition: "height 0.4s",
                  }} />
                <span style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Growing fast highlight */}
      {!loading && growingFast.length > 0 && (
        <div style={{ background: "rgba(201,168,76,0.06)", border: "1px solid var(--gold-dim)", borderRadius: "12px", padding: "14px 18px", marginBottom: "24px" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>⬆ Growing fast</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {growingFast.slice(0, 8).map(s => (
              <span key={s.id} style={{ fontSize: "0.8rem", padding: "3px 10px", borderRadius: "99px", background: "var(--bg4)", color: "var(--gold)", border: "1px solid var(--gold-dim)" }}>
                {s.skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fading skills warning */}
      {!loading && fading.length > 0 && (
        <div style={{ background: "rgba(113,113,122,0.08)", border: "1px solid var(--border2)", borderRadius: "12px", padding: "14px 18px", marginBottom: "24px" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>↓ Fading (90+ days inactive)</div>
          <div style={{ fontSize: "0.8rem", color: "#71717a" }}>{fading.map(s => s.skill).join(" · ")}</div>
        </div>
      )}

      {/* Domain tabs */}
      {!loading && skills.length > 0 && (
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "16px" }}>
          {domains.map(d => (
            <button key={d} onClick={() => setActiveDomain(d)}
              style={{
                padding: "5px 12px", borderRadius: "8px", border: "1px solid",
                fontSize: "0.76rem", cursor: "pointer", fontWeight: 500,
                borderColor: activeDomain === d ? (DOMAIN_COLORS[d] || "var(--gold)") : "var(--border2)",
                background: activeDomain === d ? `${DOMAIN_COLORS[d] || "var(--gold)"}15` : "transparent",
                color: activeDomain === d ? (DOMAIN_COLORS[d] || "var(--gold)") : "var(--text-dim)",
              }}>
              {d} {d !== "all" && `(${skills.filter(s => skillDomains(s).includes(d)).length})`}
            </button>
          ))}
        </div>
      )}

      {/* Table header */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: "flex", gap: "12px", padding: "6px 14px", marginBottom: "6px" }}>
          <div style={{ flex: "0 0 160px", fontSize: "0.68rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Skill</div>
          <div style={{ flex: "0 0 90px", fontSize: "0.68rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Domain</div>
          <div style={{ flex: 1, fontSize: "0.68rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Recency</div>
          <div style={{ flex: "0 0 80px" }} />
          <div style={{ flex: "0 0 120px", fontSize: "0.68rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Proficiency</div>
          <div style={{ flex: "0 0 40px", fontSize: "0.68rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Uses</div>
        </div>
      )}

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "10px 14px", fontSize: "0.82rem", color: "#fca5a5", marginBottom: "16px" }}>
          {error}
        </div>
      )}

      {loading && <div className="pulsing" style={{ color: "var(--text-dim)", fontSize: "0.84rem" }}>Loading skills…</div>}

      {!loading && skills.length === 0 && (
        <div style={{ color: "var(--text-dim)", fontSize: "0.84rem", textAlign: "center", padding: "60px 0" }}>
          No skills yet. Start logging your work to build your skill profile.
        </div>
      )}

      <div style={{ display: "grid", gap: "6px" }}>
        {filtered.map(skill => (
          <SkillRow key={skill.id} skill={skill} onOverride={handleOverride} />
        ))}
      </div>
    </div>
  );
}
