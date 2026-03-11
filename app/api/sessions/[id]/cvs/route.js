import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { DocumentExtractor } = require("../../../../../lib/extractor");

export async function POST(req, { params }) {
    const { id: session_id } = params;

    try {
        const formData = await req.formData();
        const file = formData.get("file");

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const name = file.name;
        const type = file.type;

        console.log(`Processing CV with Robust Extractor: ${name} (type: ${type})`);

        const buffer = Buffer.from(await file.arrayBuffer());

        // Use the robust extractor implementation
        const extractor = new DocumentExtractor();
        const result = await extractor.extractFromBuffer(buffer, name);

        let text = result.content.fullText || "";

        // Basic cleaning 
        text = text.replace(/\s+/g, " ").trim();

        if (!text || text.length < 50) {
            return NextResponse.json({
                error: "Extracted text too short (less than 50 chars). Is the document empty or a low-quality scanned image?"
            }, { status: 400 });
        }

        const { data, error } = await supabaseServer
            .from("cvs")
            .insert({ session_id, name, text })
            .select()
            .single();

        if (error) {
            console.error("Supabase error during save:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (err) {
        console.error("Robust CV Upload internal error:", err);
        // CRITICAL: Always return JSON, even for 500s, to prevent "Unexpected token <" in frontend
        return NextResponse.json({
            error: "Failed to process CV content",
            details: err.message
        }, { status: 500 });
    }
}

