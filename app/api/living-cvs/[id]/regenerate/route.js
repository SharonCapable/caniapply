import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase-server";
import { buildLivingCV } from "@/lib/living-cv";

export const dynamic = "force-dynamic";

// POST /api/living-cvs/[id]/regenerate
// Rewrites the CV in place from the latest logs — this is what keeps it "living".
export async function POST(req, { params }) {
  const { supabase, user, error: authError } = await requireUser();
  if (authError) return authError;

  const { data: cv, error: findError } = await supabase
    .from("living_cvs")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (findError || !cv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let built;
  try {
    built = await buildLivingCV(supabase, user.id, {
      name: cv.name,
      domain: cv.domain,
      context_filter: cv.context_filter,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("living_cvs")
    .update({
      generated_text: built.generated_text,
      last_generated_at: new Date().toISOString(),
    })
    .eq("id", cv.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...updated, unincorporated_log_count: 0 });
}
