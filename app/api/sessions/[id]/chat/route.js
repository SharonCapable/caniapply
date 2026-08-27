import { NextResponse } from "next/server";
import { requireUser, requireOwnedSession } from "@/lib/supabase-server";
import { generateResponse, buildCoachContext } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
    const { supabase, user, error: authError } = await requireUser();
    if (authError) return authError;

    const { id: session_id } = params;
    const { content } = await req.json().catch(() => ({}));
    if (!content?.trim()) return NextResponse.json({ error: "content is required" }, { status: 400 });

    const { session, error: ownError } = await requireOwnedSession(supabase, session_id, user.id);
    if (ownError) return ownError;

    // 1. Resolve the CV in play
    let cvQuery = supabase
        .from("cvs")
        .select("text")
        .eq("session_id", session_id)
        .eq("user_id", user.id);

    if (session.selected_cv_name) {
        cvQuery = cvQuery.eq("name", session.selected_cv_name);
    }

    const { data: cv } = await cvQuery
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    // 2. Recent work the CV may not mention yet — lets the coach spot evidence
    //    the candidate has but hasn't packaged.
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { data: recentLogs } = await supabase
        .from("work_logs")
        .select("logged_at, ai_summary, impact_statement, context_type, context_name, skills_extracted")
        .eq("user_id", user.id)
        .gte("logged_at", since)
        .order("logged_at", { ascending: false })
        .limit(40);

    // 3. Build prompt
    const context = buildCoachContext(
        cv?.text,
        session.job_description,
        session.company_insights,
        recentLogs || []
    );
    const prompt = `${context}\n\nUSER QUESTION: ${content}\n\nCOACH RESPONSE:`;

    try {
        const reply = await generateResponse(prompt);

        await supabase.from("messages").insert([
            { session_id, user_id: user.id, role: "user", content },
            { session_id, user_id: user.id, role: "assistant", content: reply },
        ]);

        return NextResponse.json({ reply });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
