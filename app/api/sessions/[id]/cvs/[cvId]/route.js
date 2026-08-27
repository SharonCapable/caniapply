import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function DELETE(_, { params }) {
    const { supabase, user, error: authError } = await requireUser();
    if (authError) return authError;

    const { error } = await supabase
        .from("cvs")
        .delete()
        .eq("id", params.cvId)
        .eq("session_id", params.id)
        .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
