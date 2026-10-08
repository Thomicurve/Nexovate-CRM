import { describe, expect, it } from "vitest";
import { performLogin } from "@/lib/auth/login";
import { authFixture, credentials } from "./fixture";

describe("password login authorization", () => {
  it.each([["", "secret"], ["member@example.invalid", ""], ["invalid", "secret"]])(
    "rejects invalid input before Auth", async (email, password) => {
      const f = authFixture();
      expect((await performLogin(f.client, credentials(email, password))).status).toBe("error");
      expect(f.signInWithPassword).not.toHaveBeenCalled();
    },
  );
  it("preserves password bytes but trims email and validates membership after sign-in", async () => {
    const f = authFixture();
    expect(await performLogin(f.client, credentials(" member@example.invalid ", " secret ")))
      .toEqual({ status: "success" });
    expect(f.signInWithPassword).toHaveBeenCalledWith({ email: "member@example.invalid", password: " secret " });
    expect(f.getUser).toHaveBeenCalledOnce();
    expect(f.rpc).toHaveBeenCalledOnce();
  });
  it("returns the approved bad-credentials message without echoing errors or passwords", async () => {
    const f = authFixture();
    f.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", message: "secret server detail" } });
    const result = await performLogin(f.client, credentials());
    expect(result).toEqual({ status: "error", email: "member@example.invalid",
      message: "Email o contraseña incorrectos. Revisá los datos e intentá de nuevo." });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("removes a newly created session for a non-member", async () => {
    const f = authFixture();
    f.rpc.mockResolvedValue({ data: false, error: null });
    expect((await performLogin(f.client, credentials())).status).toBe("denied");
    expect(f.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("never permits entry when membership or sign-out fails", async () => {
    const f = authFixture();
    f.rpc.mockRejectedValue(new Error("offline"));
    f.signOut.mockRejectedValue(new Error("offline"));
    expect((await performLogin(f.client, credentials())).status).toBe("error");
  });
  it("reports a recoverable transport error without disclosing provider details", async () => {
    const f = authFixture();
    f.signInWithPassword.mockRejectedValue(new Error("sensitive URL"));
    const result = await performLogin(f.client, credentials());
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/conectar/i);
    expect(JSON.stringify(result)).not.toContain("sensitive");
  });
});
