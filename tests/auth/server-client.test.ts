import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, clearAuthCookies } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";

const f = vi.hoisted(() => ({ create: vi.fn(), getAll: vi.fn(), set: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({ createServerClient: f.create }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: f.getAll, set: f.set }) }));

describe("request-local server cookies and public configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
    f.getAll.mockReturnValue([]);
  });
  it("creates a fresh server client and forwards writes only in an action", async () => {
    await createClient();
    expect(f.create.mock.calls[0][2].cookies.setAll).toBeUndefined();
    await createClient(true);
    const cookies = f.create.mock.calls[1][2].cookies;
    cookies.setAll([{ name: "auth", value: "new", options: { path: "/" } }], {});
    expect(f.set).toHaveBeenCalledWith("auth", "new", { path: "/" });
    f.set.mockImplementationOnce(() => { throw new Error("write forbidden"); });
    expect(() => cookies.setAll([{ name: "auth", value: "new", options: {} }], {})).toThrow("write forbidden");
    expect(f.create).toHaveBeenCalledTimes(2);
  });
  it("local logout clears only this project's cookies, including chunks", async () => {
    f.getAll.mockReturnValue([
      { name: "sb-synthetic-auth-token", value: "local" },
      { name: "sb-synthetic-auth-token.1", value: "chunk" },
      { name: "sb-synthetic-auth-token-code-verifier", value: "verifier" },
      { name: "sb-other-auth-token", value: "unrelated" },
      { name: "preference", value: "dark" },
    ]);
    await clearAuthCookies();
    expect(f.set.mock.calls.map(([name]) => name)).toEqual([
      "sb-synthetic-auth-token", "sb-synthetic-auth-token.1", "sb-synthetic-auth-token-code-verifier",
    ]);
    expect(f.set.mock.calls.every(([, value, options]) => value === "" && options.maxAge === 0 && options.path === "/")).toBe(true);
  });
  it.each(["sb_secret_forbidden", "legacy-jwt", ""])("rejects non-publishable key %s", (key) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key);
    expect(() => supabaseConfig()).toThrow();
  });
  it("rejects insecure URL and absent configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://synthetic.invalid");
    expect(() => supabaseConfig()).toThrow();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => supabaseConfig()).toThrow();
  });
});
