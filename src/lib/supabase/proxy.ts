import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { inspectAccess, type Access } from "@/lib/auth/access";
import { supabaseConfig } from "./config";

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  let access: Access = { kind: "unavailable" };
  try {
    const { url, key } = supabaseConfig();
    // Fresh per request: SDK cache headers accompany only its first cookie write.
    const client = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values, headers) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          const next = NextResponse.next({ request });
          response.cookies.getAll().forEach((cookie) => next.cookies.set(cookie));
          response.headers.forEach((value, name) => {
            if (["cache-control", "expires", "pragma"].includes(name)) next.headers.set(name, value);
          });
          values.forEach(({ name, value, options }) => next.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => next.headers.set(name, value));
          response = next;
        },
      },
    });
    access = await inspectAccess(client);
  } catch { /* Configuration, cookies or network failure denies private content. */ }
  const login = request.nextUrl.pathname === "/login";
  let destination: URL | undefined;
  if (login && access.kind === "member") destination = new URL("/dashboard", request.url);
  if (!login && access.kind !== "member") {
    destination = new URL("/login", request.url);
    destination.searchParams.set("reason", access.kind === "anonymous" ? "expired" : access.kind);
  }
  if (destination) {
    const redirect = NextResponse.redirect(destination);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    for (const name of ["cache-control", "expires", "pragma"]) {
      const value = response.headers.get(name);
      if (value) redirect.headers.set(name, value);
    }
    response = redirect;
  }
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  return response;
}
