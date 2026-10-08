import { describe, expect, it } from "vitest";
import { inspectAccess } from "@/lib/auth/access";
import { authFixture } from "./fixture";

describe("server identity and database membership", () => {
  it("authorizes only a validated user and an exact true RPC result", async () => {
    const f = authFixture();
    expect(await inspectAccess(f.client)).toEqual({ kind: "member", userId: "synthetic-member" });
    expect(f.getUser).toHaveBeenCalledOnce();
    expect(f.rpc).toHaveBeenCalledWith("current_user_is_crm_member");
  });
  it("does not request membership when no identity exists", async () => {
    const f = authFixture();
    f.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await inspectAccess(f.client)).toEqual({ kind: "anonymous" });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it.each(["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"])(
    "derives member actor %s from validated identity", async (id) => {
      const f = authFixture();
      f.getUser.mockResolvedValue({ data: { user: { id } }, error: null });
      expect(await inspectAccess(f.client)).toEqual({ kind: "member", userId: id });
    },
  );
  it("treats an invalid refresh token as expired rather than an authorized session", async () => {
    const f = authFixture();
    f.getUser.mockResolvedValue({ data: { user: null }, error: { status: 400, code: "refresh_token_not_found" } });
    expect(await inspectAccess(f.client)).toEqual({ kind: "anonymous" });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("rejects forged or expired identity before membership", async () => {
    const f = authFixture();
    f.getUser.mockResolvedValue({ data: { user: { id: "forged" } }, error: { status: 401 } });
    expect(await inspectAccess(f.client)).toEqual({ kind: "anonymous" });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it.each([false, null, "true", 1])("rejects membership value %s", async (data) => {
    const f = authFixture();
    f.rpc.mockResolvedValue({ data, error: null });
    expect(await inspectAccess(f.client)).toEqual({ kind: "denied" });
  });
  it("fails closed on RPC error even if data is true", async () => {
    const f = authFixture();
    f.rpc.mockResolvedValue({ data: true, error: { message: "database unavailable" } });
    expect(await inspectAccess(f.client)).toEqual({ kind: "unavailable" });
  });
  it.each(["identity", "membership"])("fails closed on %s transport failure", async (phase) => {
    const f = authFixture();
    (phase === "identity" ? f.getUser : f.rpc).mockRejectedValue(new Error("network"));
    expect(await inspectAccess(f.client)).toEqual({ kind: "unavailable" });
  });
});
