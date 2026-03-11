"use client";

export default function Logo({ size = "md" }) {
  const scale = size === "sm" ? 0.75 : size === "lg" ? 1.4 : 1;
  const fontSize = 18 * scale;
  const markSize = 28 * scale;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: `${8 * scale}px` }}>
      {/* Mark */}
      <svg width={markSize} height={markSize} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="13.5" stroke="#c9a84c" strokeWidth="1.2" strokeDasharray="60 26" strokeDashoffset="14" strokeLinecap="round"/>
        <path d="M16 8 L21.5 16 L16 24 L10.5 16 Z" fill="none" stroke="#c9a84c" strokeWidth="1.1"/>
        <circle cx="16" cy="16" r="2.2" fill="#c9a84c"/>
        <path d="M21.5 6.5 L24.5 9.5" stroke="#c9a84c" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>

      {/* Wordmark */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "1px" }}>
        <span style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: `${fontSize}px`,
          fontWeight: 600,
          color: "var(--text-bright)",
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}>Apply</span>
        <span style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: `${fontSize}px`,
          fontWeight: 600,
          color: "var(--gold)",
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}>IQ</span>
      </div>
    </div>
  );
}
