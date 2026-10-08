import { describe, expect, it } from "vitest";
import { assertFeedbackSave, assertFeedbackWrite, feedbackFingerprintQuery } from "../e2e/client-feedback-guards";
import { clientId, confirmed, requestId } from "./fixture";

const actor = "33333333-3333-4333-8333-333333333333", prefix = "WU006-55555555-5555-4555-8555-555555555555";
const fixtures = new Map([[clientId, { ...confirmed, name: `${prefix}-owner` }]]);
const requests = [{ actor, id: requestId, clientId }];
describe("feedback fixture pre-send ownership and privacy", () => {
  it("accepts the actual React action multipart field encoding only for a registered own client", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ request_id: requestId, client_id: clientId, name: `${prefix}-owner` })) form.set(`1_${key}`, value);
    form.set("0", '["$K1"]');
    // Exercise the browser's multipart encoder/decoder, not a handcrafted body parser.
    const encoded = new Request("http://local.invalid", { method: "POST", body: form });
    expect(() => assertFeedbackSave(form, actor, prefix, requests, fixtures)).not.toThrow();
    const parsed = await encoded.formData();
    expect(() => assertFeedbackSave(parsed, actor, prefix, requests, fixtures)).not.toThrow();
    parsed.set("1_client_id", actor);
    expect(() => assertFeedbackSave(parsed, actor, prefix, requests, fixtures)).toThrow("blocked before execution");
  });
  it("refuses unknown requests, foreign actors/clients, foreign names, ambiguous fields and a third creation", () => {
    for (const [who, req, id, name] of [[actor, actor, clientId, `${prefix}-owner`], [clientId, requestId, clientId, `${prefix}-owner`],
      [actor, requestId, actor, `${prefix}-owner`], [actor, requestId, clientId, "Existing customer"]])
      expect(() => assertFeedbackWrite(who, req, id, name, prefix, requests, fixtures)).toThrow("blocked before execution");
    const form = new FormData(); form.set("1_request_id", requestId); form.set("2_request_id", requestId);
    expect(() => assertFeedbackSave(form, actor, prefix, requests, fixtures)).toThrow("Unknown feedback form");
    const creates = [actor, requestId, clientId].map((id) => ({ actor, id, clientId: null }));
    expect(() => assertFeedbackWrite(actor, requestId, null, `${prefix}-third`, prefix, creates, fixtures)).toThrow("blocked before execution");
  });
  it("aggregates all five business tables with exact owned exclusions and no auth/PII result columns", () => {
    const query = feedbackFingerprintQuery([clientId]);
    expect(query.match(/ AS hash/g)).toHaveLength(5);
    expect(query).toContain("sha256"); expect(query).not.toContain("auth.users");
    expect(query).toContain("(response->>'id')=ANY"); expect(query).toContain("(envelope->>'client_id')=ANY");
    expect(() => feedbackFingerprintQuery(["bad'id"])).toThrow("Invalid fingerprint exclusions");
    expect(() => feedbackFingerprintQuery([actor, requestId, clientId])).toThrow("Invalid fingerprint exclusions");
  });
});
