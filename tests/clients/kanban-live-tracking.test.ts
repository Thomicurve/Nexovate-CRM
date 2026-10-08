import { describe, expect, it, vi } from "vitest";
import { parseMoveAction, trackMoveIntent } from "../e2e/kanban-live-flow";
import { clientId, confirmed, requestId } from "./fixture";

const prefix = `WU006-${requestId}`, fixtures = new Map([[clientId, { ...confirmed, name: `${prefix}-owner` }]]);
const intent = { requestId, clientId, version: 1, from: "Contactado" as const, to: "Cerrado" as const };
describe("real action fixture tracking before forwarding", () => {
  it("accepts only the owned five-field action, including a deliberately stale expected version", () => {
    expect(parseMoveAction(JSON.stringify([intent]), fixtures, prefix)).toEqual(intent);
  });
  it.each([null, "not JSON", "{}", "[]", JSON.stringify([intent, intent]), JSON.stringify([{ ...intent, extra: true }]),
    JSON.stringify([{ ...intent, requestId: "invalid" }]), JSON.stringify([{ ...intent, clientId: requestId }]),
    JSON.stringify([{ ...intent, version: "1" }]), JSON.stringify([{ ...intent, version: 0 }]),
    JSON.stringify([{ ...intent, to: "other" }]), JSON.stringify([{ ...intent, to: "Contactado" }])])(
    "blocks an unknown action before execution", (body) => {
      expect(() => parseMoveAction(body, fixtures, prefix)).toThrow();
    });
  it("rejects another run's snapshot and never broadens ownership to a known client ID", () => {
    expect(() => parseMoveAction(JSON.stringify([intent]), fixtures, "WU006-other")).toThrow("Unknown");
  });
  it("records a retry once and rejects changed payload before forwarding", () => {
    const seen = new Map<string, string>(), record = vi.fn();
    trackMoveIntent(intent, seen, record); trackMoveIntent({ ...intent }, seen, record);
    expect(record).toHaveBeenCalledOnce();
    expect(() => trackMoveIntent({ ...intent, to: "Interesado" }, seen, record)).toThrow("Retry envelope changed");
    expect(record).toHaveBeenCalledOnce();
  });
});
