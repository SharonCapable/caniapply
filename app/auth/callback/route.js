import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * Where every Supabase auth email link lands: signup confirmation, magic links,
 * password recovery. Exchanges the one-time credential in the URL for a real
 * session cookie, then drops the user into the app already signed in.
 *
 * Supabase sends one of two shapes depending on the project's email templates:
 *   ?code=...                     PKCE (the default for @supabase/ssr)
 *   ?token_hash=...&type=signup   older / hand-edited templates
 * Both are handled so a template change cannot silently produce dead links.
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") || "/";

  // Supabase reports template/link failures on the URL itself.
  const urlError = searchParams.get("error_description") || searchParams.get("error");

  // Behind Vercel's proxy the request origin is the internal host, not the
  // public one — trust x-forwarded-host in production so the redirect is right.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  const base = isLocal || !forwardedHost ? origin : `https://${forwardedHost}`;

  const fail = (message) =>
    NextResponse.redirect(`${base}/login?error=${encodeURIComponent(message)}`);

  if (urlError) return fail(urlError);

  const supabase = createServerSupabase();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.message);
    return NextResponse.redirect(`${base}${next}`);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail(error.message);
    return NextResponse.redirect(`${base}${next}`);
  }

  return fail("That confirmation link is invalid or has already been used.");
}
