import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { allows, getLineAccess, type Level } from "./auth";

/** Resolves the business line from the hidden `line` field and enforces the permission level. */
export async function lineCtx(fd: FormData, level: Level) {
  const access = await getLineAccess(String(fd.get("line") ?? ""));
  if (!allows(access.role, level)) notFound();
  return access;
}

export const str = (fd: FormData, k: string): string => String(fd.get(k) ?? "").trim();
export const opt = (fd: FormData, k: string): string | null => str(fd, k) || null;
export const int = (fd: FormData, k: string): number | null => {
  const v = str(fd, k);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};
export const isUuid = (v: string | null | undefined): v is string => !!v && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v);
export const uuid = (fd: FormData, k: string): string | null => {
  const v = str(fd, k);
  return isUuid(v) ? v : null;
};

const TRANSIENT = ["error", "notice", "confirm_main", "open"];

/** Redirect back to the page the form was submitted from, replacing transient query params. */
export async function back(params: Record<string, string> = {}, hash = ""): Promise<never> {
  revalidatePath("/", "layout");
  const ref = (await headers()).get("referer");
  let path = "/";
  const search = new URLSearchParams();
  if (ref) {
    try {
      const u = new URL(ref);
      path = u.pathname;
      u.searchParams.forEach((v, k) => {
        if (!TRANSIENT.includes(k)) search.set(k, v);
      });
    } catch {}
  }
  for (const [k, v] of Object.entries(params)) search.set(k, v);
  const qs = search.toString();
  redirect(path + (qs ? `?${qs}` : "") + (hash ? `#${hash}` : ""));
}

export const fail = (message: string) => back({ error: message });
