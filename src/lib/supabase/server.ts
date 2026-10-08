import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

export async function createClient(writable = false) {
  const store = await cookies();
  const { url, key } = supabaseConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      // Proxy refreshes before read-only Server Components. Actions propagate write failures.
      setAll: writable ? (values) => {
        values.forEach(({ name, value, options }) => store.set(name, value, options));
      } : undefined,
    },
  });
}

export async function clearAuthCookies() {
  const store = await cookies();
  const { url } = supabaseConfig();
  const prefix = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  for (const cookie of store.getAll()) {
    if (cookie.name === prefix || cookie.name.startsWith(`${prefix}.`) || cookie.name === `${prefix}-code-verifier`) {
      store.set(cookie.name, "", { path: "/", maxAge: 0, sameSite: "lax" });
    }
  }
}
