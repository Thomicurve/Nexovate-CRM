import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthClient = Pick<SupabaseClient, "auth" | "rpc">;
export type Access =
  | { kind: "member"; userId: string }
  | { kind: "anonymous" | "denied" | "unavailable" };

export async function inspectAccess(client: AuthClient): Promise<Access> {
  try {
    // getUser verifies identity with Auth; cookie/session contents alone grant nothing.
    const { data, error } = await client.auth.getUser();
    if (error) {
      const missing = error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403 ||
        ["refresh_token_not_found", "refresh_token_already_used", "bad_jwt", "session_not_found"].includes(error.code ?? "");
      return { kind: missing ? "anonymous" : "unavailable" };
    }
    if (!data.user?.id) return { kind: "anonymous" };
    const membership = await client.rpc("current_user_is_crm_member");
    if (membership.error) return { kind: "unavailable" };
    return membership.data === true
      ? { kind: "member", userId: data.user.id }
      : { kind: "denied" };
  } catch {
    return { kind: "unavailable" };
  }
}
