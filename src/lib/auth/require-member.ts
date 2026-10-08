import "server-only";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inspectAccess, type Access } from "./access";

// Call in each private page/DAL/action, independently of layout and Proxy.
export async function requireMember() {
  await connection();
  let access: Access = { kind: "unavailable" };
  let client;
  try {
    client = await createClient();
    access = await inspectAccess(client);
  } catch { /* No configuration/provider details are disclosed. */ }
  if (access.kind !== "member" || !client) {
    redirect(`/login?reason=${access.kind === "anonymous" ? "expired" : access.kind}`);
  }
  return { client, userId: access.userId };
}
