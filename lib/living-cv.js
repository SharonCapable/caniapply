import { generateLivingCV } from "@/lib/gemini";

/** "general" / "" / "all" in the UI all mean "don't filter by domain". */
export function normaliseDomain(domain) {
  const d = (domain || "").toLowerCase().trim();
  return !d || d === "general" || d === "all" ? null : d;
}

/**
 * Pull the logs + skills a Living CV is built from, then regenerate its text.
 * Shared by the create and regenerate endpoints so both stay in step.
 */
export async function buildLivingCV(supabase, userId, { name, domain, context_filter }) {
  const dom = normaliseDomain(domain);
  const filter = Array.isArray(context_filter) ? context_filter.filter(Boolean) : [];

  let logQuery = supabase
    .from("work_logs")
    .select("logged_at, ai_summary, raw_text, impact_statement, context_name, context_type, domains")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false })
    .limit(200);

  if (filter.length) logQuery = logQuery.in("context_name", filter);
  if (dom) logQuery = logQuery.contains("domains", [dom]);

  const { data: logs, error: logError } = await logQuery;
  if (logError) throw new Error(logError.message);

  if (!logs?.length) {
    throw new Error(
      dom
        ? `No work logs match the "${dom}" domain yet. Log some ${dom} work first, or choose "general".`
        : "No work logs yet — log some work before generating a CV."
    );
  }

  let skillQuery = supabase
    .from("skill_ledger")
    .select("skill, domain, domains, proficiency_estimate, proficiency_override, first_seen, last_seen, occurrence_count")
    .eq("user_id", userId)
    .order("occurrence_count", { ascending: false });

  if (dom) skillQuery = skillQuery.contains("domains", [dom]);
  const { data: skills } = await skillQuery;

  const generated_text = await generateLivingCV(name, dom, logs, skills || [], filter);

  return { generated_text, dom, filter, logCount: logs.length };
}

/**
 * How many logs have landed since each CV was last generated — this is what makes
 * a CV "living": the UI can say "12 new entries since this was written".
 */
export async function attachStaleness(supabase, userId, cvs) {
  if (!cvs?.length) return cvs;

  const oldest = cvs.reduce(
    (min, cv) => (cv.last_generated_at < min ? cv.last_generated_at : min),
    cvs[0].last_generated_at
  );

  const { data: logs } = await supabase
    .from("work_logs")
    .select("created_at, domains, context_name")
    .eq("user_id", userId)
    .gt("created_at", oldest);

  return cvs.map(cv => {
    const dom = normaliseDomain(cv.domain);
    const filter = Array.isArray(cv.context_filter) ? cv.context_filter : [];
    const newer = (logs || []).filter(l => {
      if (l.created_at <= cv.last_generated_at) return false;
      if (dom && !(Array.isArray(l.domains) && l.domains.includes(dom))) return false;
      if (filter.length && !filter.includes(l.context_name)) return false;
      return true;
    });
    return { ...cv, unincorporated_log_count: newer.length };
  });
}
