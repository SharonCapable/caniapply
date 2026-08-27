import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase-server";
import { buildLivingCV, attachStaleness, normaliseDomain } from "@/lib/living-cv";

export const dynamic = "force-dynamic";

// GET /api/living-cvs — list, annotated with how stale each one is
export async function GET() {
  const { supabase, user, error: authError } = await requireUser();
  if (authError) return authError;

  const { data, error } = await supabase
    .from("living_cvs")
    .select("id, name, domain, context_filter, last_generated_at, is_pinned, created_at")
    .eq("user_id", user.id)
    .order("last_generated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const withStaleness = await attachStaleness(supabase, user.id, data || []);
  return NextResponse.json(withStaleness);
}

// POST /api/living-cvs — generate a new Living CV
export async function POST(req) {
  const { supabase, user, error: authError } = await requireUser();
  if (authError) return authError;

  const { name, domain, context_filter } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  let built;
  try {
    built = await buildLivingCV(supabase, user.id, { name: name.trim(), domain, context_filter });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const { data: cv, error } = await supabase
    .from("living_cvs")
    .insert({
      user_id: user.id,
      name: name.trim(),
      domain: normaliseDomain(domain),
      context_filter: built.filter,
      generated_text: built.generated_text,
      last_generated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...cv, unincorporated_log_count: 0 });
}
