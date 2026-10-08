import { vi } from "vitest";
import type { AuthClient } from "@/lib/auth/access";

export function authFixture() {
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "synthetic-member" } }, error: null });
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  const signInWithPassword = vi.fn().mockResolvedValue({ data: {}, error: null });
  const signOut = vi.fn().mockResolvedValue({ error: null });
  const client = { auth: { getUser, signInWithPassword, signOut }, rpc } as unknown as AuthClient;
  return { client, getUser, rpc, signInWithPassword, signOut };
}

export function credentials(email = "member@example.invalid", password = "synthetic-password") {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  return form;
}
