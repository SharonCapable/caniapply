import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const LEVELS = ["beginner", "intermediate", "advanced", "expert"];

// GET /api/skills — full skill ledger for the current user
export async function GET(req) {
  const { supabase, user, error: authError } = await requireUser();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");

  let query = supabase
    .from("skill_ledger")
    .select("*")
    .eq("user_id", user.id)
    .order("last_seen", { ascending: false });

  // Match against the accumulated domain list, not just the primary label.
  if (domain) query = query.contains("domains", [domain]);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// PATCH /api/skills — manual proficiency override
export async function PATCH(req) {
  const { supabase, user, error: authError } = await requireUser();
  if (authError) return authError;

  const body = await req.json().catch(() => ({}));
  const { skill_id, proficiency_override } = body;

  if (!skill_id) return NextResponse.json({ error: "skill_id required" }, { status: 400 });

  const override = proficiency_override || null;
  if (override !== null && !LEVELS.includes(override)) {
    return NextResponse.json(
      { error: `proficiency_override must be one of ${LEVELS.join(", ")} or null` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("skill_ledger")
    .update({ proficiency_override: override })
    .eq("id", skill_id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  return NextResponse.json(data);
}
