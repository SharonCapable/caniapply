import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function DELETE(_, { params }) {
    const { cvId } = params;
    const { error } = await supabaseServer.from("cvs").delete().eq("id", cvId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
