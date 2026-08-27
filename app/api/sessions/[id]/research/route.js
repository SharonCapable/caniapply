import { NextResponse } from "next/server";
import { requireUser, requireOwnedSession } from "@/lib/supabase-server";
import { researchCompany } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
    const { supabase, user, error: authError } = await requireUser();
    if (authError) return authError;

    const { id: session_id } = params;
    const { error: ownError } = await requireOwnedSession(supabase, session_id, user.id, "id");
    if (ownError) return ownError;

    const { companyName, jobTitle } = await req.json().catch(() => ({}));
    if (!companyName?.trim()) {
        return NextResponse.json({ error: "companyName is required" }, { status: 400 });
    }

    try {
        const { insights, grounded } = await researchCompany(companyName, jobTitle);

        await supabase
            .from("sessions")
            .update({ company_insights: insights, company_name: companyName })
            .eq("id", session_id)
            .eq("user_id", user.id);

        return NextResponse.json({ insights, grounded });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
