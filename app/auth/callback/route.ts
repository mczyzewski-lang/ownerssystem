import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase";

// Completes Supabase e-mail confirmation / magic links (PKCE `code` or `token_hash`).
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const fail = (m: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(m)}`, url.origin));
  if (!supabaseConfigured()) return fail("Supabase Auth is not configured.");
  const supabase = await supabaseServer();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Missing confirmation code.") };
  if (error) return fail(error.message);
  return NextResponse.redirect(new URL("/", url.origin));
}
