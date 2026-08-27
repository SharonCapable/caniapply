import { NextResponse } from "next/server";
import { requireUser, requireOwnedSession } from "@/lib/supabase-server";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { DocumentExtractor } = require("../../../../../lib/extractor");

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
    const { supabase, user, error: authError } = await requireUser();
    if (authError) return authError;

    const { id: session_id } = params;
    const { error: ownError } = await requireOwnedSession(supabase, session_id, user.id, "id");
    if (ownError) return ownError;

    try {
        const formData = await req.formData();
        const file = formData.get("file");

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
            return NextResponse.json({ error: "File is larger than 10 MB" }, { status: 413 });
        }

        const name = file.name;

        console.log(`Processing CV with Robust Extractor: ${name} (type: ${file.type})`);

        const buffer = Buffer.from(await file.arrayBuffer());

        const extractor = new DocumentExtractor();
        const result = await extractor.extractFromBuffer(buffer, name);

        let text = (result.content.fullText || "").replace(/\s+/g, " ").trim();

        if (!text || text.length < 50) {
            return NextResponse.json({
                error: "Extracted text too short (less than 50 chars). Is the document empty or a low-quality scanned image?"
            }, { status: 400 });
        }

        const { data, error } = await supabase
            .from("cvs")
            .insert({ session_id, user_id: user.id, name, text, source: "upload" })
            .select("id, name, source, living_cv_id")
            .single();

        if (error) {
            console.error("Supabase error during save:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (err) {
        console.error("Robust CV Upload internal error:", err);
        // Always return JSON, even for 500s, to prevent "Unexpected token <" in the frontend.
        return NextResponse.json({
            error: "Failed to process CV content",
            details: err.message
        }, { status: 500 });
    }
}
