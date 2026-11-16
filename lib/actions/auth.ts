"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEV_COOKIE } from "../auth";
import { devAuthEnabled, supabaseConfigured, supabaseServer } from "../supabase";
import { isUuid, str } from "../action-utils";

const loginError = (m: string) => redirect(`/login?error=${encodeURIComponent(m)}`);

export async function devSignIn(fd: FormData) {
  if (!devAuthEnabled()) loginError("Dev sign-in is disabled.");
  const id = str(fd, "user");
  if (!isUuid(id)) loginError("Unknown user.");
  (await cookies()).set(DEV_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/");
}

export async function signIn(fd: FormData) {
  if (!supabaseConfigured()) loginError("Supabase Auth is not configured.");
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: str(fd, "email"), password: String(fd.get("password") ?? "") });
  if (error) loginError(error.message);
  redirect("/");
}

export async function signUp(fd: FormData) {
  if (!supabaseConfigured()) loginError("Supabase Auth is not configured.");
  const supabase = await supabaseServer();
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? h.get("origin") ?? `https://${h.get("host")}`;
  const { data, error } = await supabase.auth.signUp({
    email: str(fd, "email"),
    password: String(fd.get("password") ?? ""),
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) loginError(error.message);
  if (!data.session) redirect(`/login?notice=${encodeURIComponent("Sprawdź skrzynkę e-mail i potwierdź adres, aby się zalogować.")}`);
  redirect("/");
}

export async function signOut() {
  if (supabaseConfigured()) await (await supabaseServer()).auth.signOut();
  (await cookies()).delete(DEV_COOKIE);
  redirect("/login");
}
