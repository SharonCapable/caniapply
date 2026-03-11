import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function GET(_, { params }) {
    const { id } = params;

    // Get session details
    const { data: session, error: sErr } = await supabaseServer
        .from("sessions")
        .select("*")
        .eq("id", id)
        .single();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    // Get CVs
    const { data: cvs } = await supabaseServer
        .from("cvs")
        .select("id, name")
        .eq("session_id", id);

    // Get Messages
    const { data: messages } = await supabaseServer
        .from("messages")
        .select("role, content, created_at")
        .eq("session_id", id)
        .order("created_at", { ascending: true });

    return NextResponse.json({ ...session, cvs: cvs || [], messages: messages || [] });
}

export async function PATCH(req, { params }) {
    const { id } = params;
    const body = await req.json();

    const { data, error } = await supabaseServer
        .from("sessions")
        .update(body)
        .eq("id", id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function DELETE(_, { params }) {
    const { id } = params;
    const { error } = await supabaseServer.from("sessions").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
