import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { researchCompany } from "@/lib/gemini";

export async function POST(req, { params }) {
    const { id: session_id } = params;
    const { companyName, jobTitle } = await req.json();

    try {
        const insights = await researchCompany(companyName, jobTitle);

        // Update session
        await supabaseServer
            .from("sessions")
            .update({ company_insights: insights })
            .eq("id", session_id);

        return NextResponse.json({ insights });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
