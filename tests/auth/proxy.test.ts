// A mocked SDK exercises our cookie adapter and routing, not Supabase token renewal.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CookieMethodsServer } from "@supabase/ssr";
import { updateSession } from "@/lib/supabase/proxy";
import { authFixture } from "./fixture";

const sdk = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: sdk.create }));
vi.mock("server-only", () => ({}));

describe("SSR request session boundaries", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
  });
  function setup() {
    const f = authFixture();
    let cookies: CookieMethodsServer;
    sdk.create.mockImplementation((_url, _key, options) => {
      cookies = options.cookies;
      return f.client;
    });
    return { ...f, write: () => cookies.setAll!([
      { name: "sb-synthetic-auth-token.0", value: "renewed", options: { httpOnly: true, sameSite: "lax", path: "/" } },
      { name: "sb-synthetic-auth-token.1", value: "", options: { maxAge: 0, path: "/" } },
    ], { "Cache-Control": "private, no-store", Expires: "0", Pragma: "no-cache" }) };
  }
  it("copies every refreshed/removed cookie and cache header to a redirect", async () => {
    const f = setup();
    f.getUser.mockImplementation(async () => {
      await f.write();
      return { data: { user: null }, error: null };
    });
    const request = new NextRequest("http://localhost/dashboard");
    const result = await updateSession(request);
    expect(result.headers.get("location")).toBe("http://localhost/login?reason=expired");
    expect(result.cookies.get("sb-synthetic-auth-token.0")?.value).toBe("renewed");
    expect(result.cookies.get("sb-synthetic-auth-token.1")?.maxAge).toBe(0);
    expect(request.cookies.get("sb-synthetic-auth-token.0")?.value).toBe("renewed");
    expect(result.headers.get("cache-control")).toContain("no-store");
    expect(result.headers.get("expires")).toBe("0");
    expect(result.headers.get("pragma")).toBe("no-cache");
  });
  it("preserves cookies on pass-through and creates a fresh SDK client per request", async () => {
    const f = setup();
    f.getUser.mockImplementation(async () => {
      await f.write();
      return { data: { user: { id: "member" } }, error: null };
    });
    const count = sdk.create.mock.calls.length;
    for (let i = 0; i < 2; i++) {
      const result = await updateSession(new NextRequest("http://localhost/dashboard"));
      expect(result.headers.get("location")).toBeNull();
      expect(result.cookies.get("sb-synthetic-auth-token.0")?.value).toBe("renewed");
    }
    expect(sdk.create.mock.calls.length - count).toBe(2);
  });
  it("redirects a non-member and never lets provider failures pass through", async () => {
    const f = setup();
    f.rpc.mockResolvedValue({ data: false, error: null });
    expect((await updateSession(new NextRequest("http://localhost/dashboard"))).headers.get("location"))
      .toBe("http://localhost/login?reason=denied");
    f.getUser.mockRejectedValue(new Error("offline"));
    expect((await updateSession(new NextRequest("http://localhost/dashboard"))).headers.get("location"))
      .toBe("http://localhost/login?reason=unavailable");
  });
  it("retains first-write headers and cookies through a later SDK write and redirect", async () => {
    const f = authFixture();
    sdk.create.mockImplementation((_url, _key, options) => {
      f.getUser.mockImplementation(async () => {
        await options.cookies.setAll([{ name: "first", value: "one", options: { path: "/" } }],
          { "Cache-Control": "private, no-store", Expires: "0", Pragma: "no-cache" });
        await options.cookies.setAll([{ name: "second", value: "two", options: { path: "/" } }], {});
        return { data: { user: null }, error: null };
      });
      return f.client;
    });
    const result = await updateSession(new NextRequest("http://localhost/dashboard"));
    expect(result.cookies.get("first")?.value).toBe("one");
    expect(result.cookies.get("second")?.value).toBe("two");
    expect(result.headers.get("expires")).toBe("0");
    expect(result.headers.get("pragma")).toBe("no-cache");
  });
  it("allows login to render on outage and sends authenticated members to dashboard", async () => {
    const f = setup();
    f.getUser.mockRejectedValue(new Error("offline"));
    expect((await updateSession(new NextRequest("http://localhost/login"))).headers.get("location")).toBeNull();
    f.getUser.mockResolvedValue({ data: { user: { id: "member" } }, error: null });
    expect((await updateSession(new NextRequest("http://localhost/login?next=https://evil.invalid"))).headers.get("location"))
      .toBe("http://localhost/dashboard");
  });
});
