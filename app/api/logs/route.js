import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase-server";
import { extractWorkLogInsights } from "@/lib/gemini";
import { normaliseSkillList, normaliseDomains, foldSkillsIntoLedger } from "@/lib/skills";

export const dynamic = "force-dynamic";

// GET /api/logs — list logs for current user
export async function GET(req) {
  const { supabase, user, error: authError } = await requireUser();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");
  const context = searchParams.get("context");
  const contextName = searchParams.get("context_name");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);

  let query = supabase
    .from("work_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("logged_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (context) query = query.eq("context_type", context);
  if (contextName) query = query.eq("context_name", contextName);
  if (domain) query = query.contains("domains", [domain]);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// POST /api/logs — create a log, run AI extraction, fold the skills into the ledger
export async function POST(req) {
  const { supabase, user, error: authError } = await requireUser();
  if (authError) return authError;

  const body = await req.json().catch(() => ({}));
  const { raw_text, context_type, context_name, logged_at } = body;

  if (!raw_text?.trim()) {
    return NextResponse.json({ error: "raw_text is required" }, { status: 400 });
  }
  if (context_type && !["personal", "client", "company"].includes(context_type)) {
    return NextResponse.json({ error: "context_type must be personal, client or company" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];
  const loggedDate = /^\d{4}-\d{2}-\d{2}$/.test(logged_at || "") ? logged_at : today;
  if (loggedDate > today) {
    return NextResponse.json({ error: "logged_at cannot be in the future" }, { status: 400 });
  }

  // ── AI extraction (non-fatal: a failed extraction must not lose the entry) ──
  let aiData = { summary: "", skills: [], domains: [], impact_statement: "" };
  let extractionFailed = false;
  try {
    aiData = await extractWorkLogInsights(raw_text, context_type, context_name);
  } catch (err) {
    console.error("AI extraction failed:", err);
    extractionFailed = true;
  }

  const skills = normaliseSkillList(aiData.skills);
  const domains = normaliseDomains(aiData.domains);

  const { data: log, error: logError } = await supabase
    .from("work_logs")
    .insert({
      user_id: user.id,
      logged_at: loggedDate,
      raw_text,
      ai_summary: aiData.summary || null,
      skills_extracted: skills.map(s => s.skill),
      domains,
      context_type: context_type || "personal",
      context_name: context_type && context_type !== "personal" ? (context_name || null) : null,
      impact_statement: aiData.impact_statement || null,
    })
    .select()
    .single();

  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 });

  await foldSkillsIntoLedger(supabase, user.id, skills, domains, loggedDate);

  return NextResponse.json({
    log,
    extracted: { ...aiData, skills: skills.map(s => s.skill), domains },
    warning: extractionFailed
      ? "Saved, but AI extraction failed — no skills were recorded for this entry."
      : null,
  });
}
