import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { generateResponse } from "@/lib/gemini";

export async function POST(req, { params }) {
    const { id: session_id } = params;

    // 1. Get Session & All CVs
    const { data: session } = await supabaseServer
        .from("sessions")
        .select("job_description")
        .eq("id", session_id)
        .single();

    const { data: cvs } = await supabaseServer
        .from("cvs")
        .select("id, name, text")
        .eq("session_id", session_id);

    if (!cvs?.length) return NextResponse.json({ error: "No CVs found" }, { status: 400 });

    // 2. Build Prompt
    const prompt = `Analyze the following job description and multiple CVs. Select the BEST CV for this role.

JOB DESCRIPTION:
${session.job_description}

CVS:
${cvs.map((c, i) => `CV ${i + 1} [ID: ${c.id}, Name: ${c.name}]:\n${c.text}\n---`).join("\n")}

Respond ONLY with the name of the best matching CV. No explanation. Just the exact name as provided.`;

    // 3. Generate Response
    try {
        const suggested_cv_name = await generateResponse(prompt);
        const suggested_cv = cvs.find(c => c.name.toLowerCase().includes(suggested_cv_name.toLowerCase()) || suggested_cv_name.toLowerCase().includes(c.name.toLowerCase()));

        // Update session
        if (suggested_cv) {
            await supabaseServer
                .from("sessions")
                .update({ selected_cv_name: suggested_cv.name })
                .eq("id", session_id);
        }

        return NextResponse.json({ suggested_cv_id: suggested_cv?.id, suggested_cv_name: suggested_cv?.name });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
