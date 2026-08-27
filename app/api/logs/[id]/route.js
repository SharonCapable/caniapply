import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// GET /api/logs/[id]
export async function GET(req, { params }) {
  const { supabase, user, error: authError } = await requireUser();
  if (authError) return authError;

  const { data, error } = await supabase
    .from("work_logs")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

// DELETE /api/logs/[id]
export async function DELETE(req, { params }) {
  const { supabase, user, error: authError } = await requireUser();
  if (authError) return authError;

  const { error } = await supabase
    .from("work_logs")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
