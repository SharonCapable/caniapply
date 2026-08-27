import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase, user, error: authError } = await requireUser();
  if (authError) return authError;

  const { data, error } = await supabase
    .from("sessions")
    .select("id, title, company_name, selected_cv_name, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req) {
  const { supabase, user, error: authError } = await requireUser();
  if (authError) return authError;

  const { title } = await req.json().catch(() => ({}));

  const { data, error } = await supabase
    .from("sessions")
    .insert({ user_id: user.id, title: title || "New Application" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
