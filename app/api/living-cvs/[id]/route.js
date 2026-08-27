import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// Only these are user-editable — a raw PATCH body must not be able to set user_id.
const PATCHABLE = ["name", "is_pinned", "domain", "context_filter"];

// GET /api/living-cvs/[id] — full record, including generated_text
export async function GET(req, { params }) {
  const { supabase, user, error: authError } = await requireUser();
  if (authError) return authError;

  const { data, error } = await supabase
    .from("living_cvs")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

// PATCH /api/living-cvs/[id] — rename / pin
export async function PATCH(req, { params }) {
  const { supabase, user, error: authError } = await requireUser();
  if (authError) return authError;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  for (const key of PATCHABLE) {
    if (key in body) patch[key] = body[key];
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("living_cvs")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

// DELETE /api/living-cvs/[id]
export async function DELETE(req, { params }) {
  const { supabase, user, error: authError } = await requireUser();
  if (authError) return authError;

  const { error } = await supabase
    .from("living_cvs")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
