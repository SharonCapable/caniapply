import { NextResponse } from "next/server";
import { requireUser, requireOwnedSession } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// POST /api/sessions/[id]/cvs/from-living  { living_cv_id }
// Copies a Living CV's current text into this application session as a real `cvs` row,
// so the coach, gap analysis and auto-suggest all read it the same way as an upload.
export async function POST(req, { params }) {
  const { supabase, user, error: authError } = await requireUser();
  if (authError) return authError;

  const { id: session_id } = params;
  const { error: ownError } = await requireOwnedSession(supabase, session_id, user.id, "id");
  if (ownError) return ownError;

  const { living_cv_id } = await req.json().catch(() => ({}));
  if (!living_cv_id) return NextResponse.json({ error: "living_cv_id is required" }, { status: 400 });

  const { data: living, error: livingError } = await supabase
    .from("living_cvs")
    .select("id, name, generated_text")
    .eq("id", living_cv_id)
    .eq("user_id", user.id)
    .single();

  if (livingError || !living) {
    return NextResponse.json({ error: "Living CV not found" }, { status: 404 });
  }

  // Re-attaching the same Living CV refreshes the snapshot rather than duplicating it.
  const { data: existing } = await supabase
    .from("cvs")
    .select("id")
    .eq("session_id", session_id)
    .eq("living_cv_id", living.id)
    .maybeSingle();

  const payload = {
    session_id,
    user_id: user.id,
    name: living.name,
    text: living.generated_text,
    source: "living",
    living_cv_id: living.id,
  };

  const query = existing
    ? supabase.from("cvs").update(payload).eq("id", existing.id)
    : supabase.from("cvs").insert(payload);

  const { data: cv, error } = await query.select("id, name, source, living_cv_id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("sessions")
    .update({ selected_cv_name: living.name })
    .eq("id", session_id)
    .eq("user_id", user.id);

  return NextResponse.json(cv);
}
