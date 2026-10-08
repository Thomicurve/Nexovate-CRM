import { beforeEach, describe, expect, it, vi } from "vitest";
import { authFixture, credentials } from "./fixture";
import { requireMember } from "@/lib/auth/require-member";
import { login, logout } from "@/app/login/actions";

const boundary = vi.hoisted(() => ({ create: vi.fn(), clear: vi.fn(), connection: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: boundary.create, clearAuthCookies: boundary.clear }));
vi.mock("next/server", () => ({ connection: boundary.connection }));
vi.mock("next/navigation", () => ({ redirect: boundary.redirect }));

describe("independent server operation boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.redirect.mockImplementation((path) => { throw new Error(`redirect:${path}`); });
  });
  it("DAL validates identity and membership without relying on Proxy/layout", async () => {
    const f = authFixture();
    boundary.create.mockResolvedValue(f.client);
    expect(await requireMember()).toEqual({ client: f.client, userId: "synthetic-member" });
    expect(boundary.connection).toHaveBeenCalledOnce();
    expect(f.getUser).toHaveBeenCalledOnce();
    expect(f.rpc).toHaveBeenCalledOnce();
  });
  it.each(["anonymous", "denied", "unavailable"])("DAL blocks %s direct requests", async (kind) => {
    const f = authFixture();
    boundary.create.mockResolvedValue(f.client);
    if (kind === "anonymous") f.getUser.mockResolvedValue({ data: { user: null }, error: null });
    if (kind === "denied") f.rpc.mockResolvedValue({ data: false, error: null });
    if (kind === "unavailable") f.rpc.mockRejectedValue(new Error("offline"));
    await expect(requireMember()).rejects.toThrow(`redirect:/login?reason=${kind === "anonymous" ? "expired" : kind}`);
  });
  it("login action checks membership then redirects outside the error catch", async () => {
    const f = authFixture();
    boundary.create.mockResolvedValue(f.client);
    await expect(login({ status: "idle" }, credentials())).rejects.toThrow("redirect:/dashboard");
    expect(boundary.create).toHaveBeenCalledWith(true);
    expect(f.getUser).toHaveBeenCalledOnce();
    expect(f.rpc).toHaveBeenCalledOnce();
    expect(boundary.clear).not.toHaveBeenCalled();
  });
  it("denied login clears cookies and redirects to the complete denied panel", async () => {
    const f = authFixture();
    boundary.create.mockResolvedValue(f.client);
    f.rpc.mockResolvedValue({ data: false, error: null });
    await expect(login({ status: "idle" }, credentials())).rejects.toThrow("redirect:/login?reason=denied");
    expect(boundary.clear).toHaveBeenCalledOnce();
  });
  it("denied account can logout without acquiring protected access", async () => {
    const f = authFixture();
    boundary.create.mockResolvedValue(f.client);
    f.rpc.mockResolvedValue({ data: false, error: null });
    await expect(logout()).rejects.toThrow("redirect:/login");
    expect(f.getUser).toHaveBeenCalledOnce();
    expect(f.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(boundary.clear).toHaveBeenCalledOnce();
  });
  it("logout clears browser session even on an Auth transport outage", async () => {
    const f = authFixture();
    boundary.create.mockResolvedValue(f.client);
    f.getUser.mockRejectedValue(new Error("offline"));
    f.signOut.mockRejectedValue(new Error("offline"));
    await expect(logout()).rejects.toThrow("redirect:/login");
    expect(boundary.clear).toHaveBeenCalledOnce();
  });
});
