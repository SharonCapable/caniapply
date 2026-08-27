import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase-server";
import { extractWorkLogInsights } from "@/lib/gemini";
import { normaliseSkillList, normaliseDomains, foldSkillsIntoLedger } from "@/lib/skills";

export const dynamic = "force-dynamic";

/**
 * POST /api/logs/[id]/reextract
 *
 * Re-runs extraction on an entry that was saved without skills — because the model
 * was down, the id had been retired, or the key was misconfigured. Log entries are
 * never lost to a transient AI failure, so this is how you recover them afterwards.
 */
export async function POST(req, { params }) {
  const { supabase, user, error: authError } = await requireUser();
  if (authError) return authError;

  const { data: log, error: findError } = await supabase
    .from("work_logs")
    .select("id, raw_text, logged_at, context_type, context_name, skills_extracted")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (findError || !log) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let aiData;
  try {
    aiData = await extractWorkLogInsights(log.raw_text, log.context_type, log.context_name);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }

  const skills = normaliseSkillList(aiData.skills);
  const domains = normaliseDomains(aiData.domains);

  if (!skills.length) {
    return NextResponse.json(
      { error: "The model returned no skills for this entry. Try adding more detail to it." },
      { status: 422 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("work_logs")
    .update({
      ai_summary: aiData.summary || null,
      skills_extracted: skills.map(s => s.skill),
      domains,
      impact_statement: aiData.impact_statement || null,
    })
    .eq("id", log.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Only credit the ledger for skills this entry had not already contributed,
  // so re-running extraction cannot inflate occurrence counts.
  const already = new Set(
    normaliseSkillList(log.skills_extracted || []).map(s => s.key)
  );
  const fresh = skills.filter(s => !already.has(s.key));

  await foldSkillsIntoLedger(supabase, user.id, fresh, domains, log.logged_at);

  return NextResponse.json({ log: updated, extracted: { ...aiData, skills: skills.map(s => s.skill), domains } });
}
