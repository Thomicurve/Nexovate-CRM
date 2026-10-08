"use server";

import { redirect } from "next/navigation";
import { createClient, clearAuthCookies } from "@/lib/supabase/server";
import { inspectAccess } from "@/lib/auth/access";
import { connectionMessage, performLogin, type LoginState } from "@/lib/auth/login";

export async function login(_previous: LoginState, form: FormData): Promise<LoginState> {
  let result: LoginState;
  try {
    result = await performLogin(await createClient(true), form);
    if (result.status !== "success") await clearAuthCookies();
  } catch {
    return { status: "error", message: connectionMessage };
  }
  if (result.status === "success") redirect("/dashboard");
  if (result.status === "denied") redirect("/login?reason=denied");
  return result;
}

export async function logout() {
  // A denied account can remove its own session; this grants no protected read/write.
  try {
    const client = await createClient(true);
    await inspectAccess(client);
    await client.auth.signOut({ scope: "local" });
  } catch { /* Local removal still works on an Auth outage. */ }
  await clearAuthCookies();
  redirect("/login");
}
