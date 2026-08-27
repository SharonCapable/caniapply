import { NextResponse } from "next/server";
import { requireUser, requireOwnedSession } from "@/lib/supabase-server";
import { generateResponse } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
    const { supabase, user, error: authError } = await requireUser();
    if (authError) return authError;

    const { id: session_id } = params;
    const { session, error: ownError } = await requireOwnedSession(
        supabase, session_id, user.id, "job_description"
    );
    if (ownError) return ownError;

    if (!session.job_description?.trim()) {
        return NextResponse.json({ error: "Add a job description first" }, { status: 400 });
    }

    // Includes Living CVs attached to this session — they are ordinary `cvs` rows.
    const { data: cvs } = await supabase
        .from("cvs")
        .select("id, name, text, source")
        .eq("session_id", session_id)
        .eq("user_id", user.id);

    if (!cvs?.length) return NextResponse.json({ error: "No CVs found" }, { status: 400 });
    if (cvs.length === 1) {
        await supabase.from("sessions")
            .update({ selected_cv_name: cvs[0].name })
            .eq("id", session_id).eq("user_id", user.id);
        return NextResponse.json({ suggested_cv_id: cvs[0].id, suggested_cv_name: cvs[0].name });
    }

    const prompt = `Analyze the following job description and multiple CVs. Select the BEST CV for this role.

JOB DESCRIPTION:
${session.job_description}

CVS:
${cvs.map((c, i) => `CV ${i + 1} [Name: ${c.name}]:\n${(c.text || "").slice(0, 8000)}\n---`).join("\n")}

Respond ONLY with the name of the best matching CV. No explanation. Just the exact name as provided.`;

    try {
        const raw = (await generateResponse(prompt)).trim();
        const needle = raw.toLowerCase();
        const suggested_cv =
            cvs.find(c => c.name.toLowerCase() === needle) ||
            cvs.find(c => needle.includes(c.name.toLowerCase())) ||
            cvs.find(c => c.name.toLowerCase().includes(needle));

        if (suggested_cv) {
            await supabase
                .from("sessions")
                .update({ selected_cv_name: suggested_cv.name })
                .eq("id", session_id)
                .eq("user_id", user.id);
        }

        return NextResponse.json({
            suggested_cv_id: suggested_cv?.id || null,
            suggested_cv_name: suggested_cv?.name || null,
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
