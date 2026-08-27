import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

/**
 * Per-request Supabase client bound to the caller's auth cookies.
 * Must be created inside the request scope — never cached at module level.
 */
export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — middleware refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Resolve the caller. Returns { supabase, user, error } where `error` is a ready-to-return
 * 401 NextResponse when there is no authenticated user.
 *
 *   const { supabase, user, error } = await requireUser();
 *   if (error) return error;
 */
export async function requireUser() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      supabase,
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { supabase, user, error: null };
}

/**
 * Confirm the session belongs to the caller before touching its child rows.
 * Returns a 404 NextResponse if it does not (404 not 403 — don't leak existence).
 */
export async function requireOwnedSession(supabase, sessionId, userId, columns = "*") {
  const { data, error } = await supabase
    .from("sessions")
    .select(columns)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return { session: null, error: NextResponse.json({ error: "Session not found" }, { status: 404 }) };
  }
  return { session: data, error: null };
}
