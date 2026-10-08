import { describe, expect, it } from "vitest";
import { localToUtc, utcToLocal } from "@/lib/clients/dates";
import { normalizeForm, safeReturnPath } from "@/lib/clients/model";

import { clientId, form } from "./fixture";

describe("Buenos Aires instants and form contract", () => {
  it("converts current and historical DST independently of host timezone", () => {
    expect(localToUtc("2026-10-07T12:30")).toBe("2026-10-07T15:30:00.000Z");
    expect(localToUtc("2008-01-10T12:30")).toBe("2008-01-10T14:30:00.000Z");
    expect(utcToLocal("2026-10-07T15:30:42.123Z")).toBe("2026-10-07T12:30");
  });
  it.each(["2026-02-30T12:30", "2026-10-07T24:00", "not-a-date", "2007-12-30T00:30", "2008-03-15T23:30"])(
    "rejects invalid, nonexistent or ambiguous local time %s", (value) => expect(localToUtc(value)).toBeNull());
  it("trims text, maps empty optional fields to null, and lets SQL set initial contact instant", () => {
    const result = normalizeForm(form());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("validation failed");
    expect(result.payload).toEqual({ name: "Cliente prueba", company: null, email: null, phone: null,
      rubro: null, notes: null, meeting_at: null });
    expect(result.mode).toBe("create");
  });
  it("preserves seconds on untouched contact/meeting dates and includes edit status", () => {
    const result = normalizeForm(form({ client_id: clientId, version: "7", status: "Cerrado",
      original_contact: "2026-10-07T15:30:42.123Z", meeting_at: "2026-10-08T10:00",
      original_meeting: "2026-10-08T13:00:55.000Z" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload).toMatchObject({ status: "Cerrado",
      contact_at: "2026-10-07T15:30:42.123Z", meeting_at: "2026-10-08T13:00:55.000Z" });
  });
  it("preserves the known original instant even when its historical local minute is ambiguous", () => {
    const result = normalizeForm(form({ client_id: clientId, version: "1", status: "Contactado",
      contact_at: "2008-03-15T23:30", original_contact: "2008-03-16T01:30:44.123Z" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.contact_at).toBe("2008-03-16T01:30:44.123Z");
  });
  it.each([{ name: "   " }, { email: "broken" }, { contact_at: "2026-02-30T10:00" },
    { meeting_at: "2026-02-30T10:00" }, { request_id: "bad" }, { client_id: clientId, version: "0" },
    { client_id: clientId, version: "9007199254740992", status: "Cerrado" },
    { client_id: clientId, version: "1", status: "Fake" }, { client_id: "bad", version: "1" }])(
    "rejects malformed fields before RPC: %j", (fields) => expect(normalizeForm(form(fields)).ok).toBe(false));
  it("never accepts a caller-supplied status on create", () => {
    const result = normalizeForm(form({ status: "Cerrado" }));
    if (!result.ok) throw new Error("validation failed");
    expect(result.payload).not.toHaveProperty("status");
  });
  it("allowlists return filters and rejects external/encoded paths", () => {
    expect(safeReturnPath("/clientes?nombre=Socio&estado=Cerrado&desde=2026-01-01&secret=drop")).toBe(
      "/clientes?nombre=Socio&estado=Cerrado&desde=2026-01-01");
    for (const value of ["https://evil.invalid", "//evil.invalid", "/clientes/../login", "/%63lientes", "/clientes#bad"])
      expect(safeReturnPath(value)).toBe("/clientes");
  });
});
