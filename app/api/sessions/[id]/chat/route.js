import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { generateResponse, buildCoachContext } from "@/lib/gemini";

export async function POST(req, { params }) {
    const { id: session_id } = params;
    const { content } = await req.json();

    // 1. Get Session & Selected CV
    const { data: session } = await supabaseServer
        .from("sessions")
        .select("*")
        .eq("id", session_id)
        .single();

    const { data: cv } = await supabaseServer
        .from("cvs")
        .select("text")
        .eq("session_id", session_id)
        .eq("name", session.selected_cv_name)
        .single();

    // 2. Build AI Prompt
    const context = buildCoachContext(cv?.text, session.job_description, session.company_insights);
    const prompt = `${context}\n\nUSER QUESTION: ${content}\n\nCOACH RESPONSE:`;

    // 3. Generate Response
    try {
        const reply = await generateResponse(prompt);

        // 4. Store in DB
        await supabaseServer.from("messages").insert([
            { session_id, role: "user", content },
            { session_id, role: "assistant", content: reply },
        ]);

        return NextResponse.json({ reply });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
