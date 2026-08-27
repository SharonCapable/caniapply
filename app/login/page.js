"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // /auth/callback redirects here with ?error=... when a link is stale or invalid.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("error");
    if (param) {
      setError(param);
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        window.location.href = "/";
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });

      if (error) {
        setError(error.message);
      } else if (data.session) {
        // Email confirmation is off in this Supabase project — already signed in.
        window.location.href = "/";
        return;
      } else {
        // Confirmation is on. Supabase returns this same shape for an address that
        // is already registered, which is deliberate — it avoids leaking who has
        // an account — so the wording has to work for both cases.
        setMessage("Check your email for a confirmation link. Once you confirm, you'll be signed in automatically.");
      }
    }
    setLoading(false);
  };

  const inp = {
    width: "100%", background: "#121215", border: "1px solid #3f3f46",
    borderRadius: "10px", padding: "12px 14px", color: "#fafafa",
    fontSize: "0.88rem", outline: "none", fontFamily: "inherit",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#09090b", padding: "24px",
    }}>
      <div style={{ width: "100%", maxWidth: "380px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <Logo size="lg" />
          <p style={{ marginTop: "12px", color: "#a1a1aa", fontSize: "0.84rem" }}>
            Your living career intelligence platform
          </p>
        </div>

        <div style={{
          background: "#18181b", border: "1px solid #27272a", borderRadius: "16px", padding: "32px",
        }}>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem",
            color: "#fafafa", marginBottom: "24px", textAlign: "center",
          }}>
            {mode === "login" ? "Welcome back" : "Create account"}
          </h2>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
            <div>
              <label style={{ fontSize: "0.72rem", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "6px" }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required style={inp} placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label style={{ fontSize: "0.72rem", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "6px" }}>
                Password
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required style={inp} placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "10px 14px", fontSize: "0.82rem", color: "#fca5a5" }}>
                {error}
              </div>
            )}

            {message && (
              <div style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: "8px", padding: "10px 14px", fontSize: "0.82rem", color: "#c9a84c" }}>
                {message}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                padding: "12px", background: "#c9a84c", color: "#0c0b09",
                border: "none", borderRadius: "10px", fontSize: "0.88rem",
                fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1, transition: "opacity 0.15s",
              }}
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <button
              onClick={() => { setMode(m => m === "login" ? "signup" : "login"); setError(null); setMessage(null); }}
              style={{ background: "none", border: "none", color: "#a1a1aa", fontSize: "0.82rem", cursor: "pointer", textDecoration: "underline" }}
            >
              {mode === "login" ? "No account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
