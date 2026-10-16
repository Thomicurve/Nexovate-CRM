import { describe, expect, it, vi } from "vitest";
import { performCommentMutation, readCommentPage } from "@/lib/comments/api";
import { isComment, validCommentText, type ClientComment } from "@/lib/comments/model";
import { createClient } from "@supabase/supabase-js";
const clientId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const requestId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const comment: ClientComment = { id: requestId, client_id: clientId, body: "Texto\nexacto", legacy: false,
  author_id: clientId, author_email: "first@example.test", created_at: "2026-10-16T15:00:00.123456+00:00",
  imported_at: null, sort_at: "2026-10-16T15:00:00.123456+00:00", archived_by: null, archived_by_email: null, archived_at: null };
describe("comment contracts", () => {
  it.each(["\u00a0", "\ufeff", "\u1680", "\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a", "\u2028\u2029\u202f\u205f\u3000"])(
    "rejects Unicode-only whitespace and preserves real content surrounded by it", async (whitespace) => {
      const rpc = vi.fn();
      expect(validCommentText(whitespace)).toBe(false);
      expect(await performCommentMutation({ rpc }, "create", { requestId, clientId, body: whitespace })).toEqual({ kind: "invalid" });
      expect(rpc).not.toHaveBeenCalled();
      const body = `${whitespace}Texto\nexacto${whitespace}`;
      rpc.mockResolvedValue({ data: { request_id: requestId, comment: { ...comment, body } }, error: null });
      expect(await performCommentMutation({ rpc }, "create", { requestId, clientId, body })).toEqual({ kind: "success", comment: { ...comment, body } });
      expect(rpc).toHaveBeenCalledWith("create_client_comment", { p_request_id: requestId, p_client_id: clientId, p_body: body });
      expect(isComment({ ...comment, body: whitespace })).toBe(false);
    });
  it("rejects forged metadata and blank/oversize text before a call", async () => {
    const rpc = vi.fn();
    for (const extra of [{ body: " " }, { body: "x".repeat(5001) }, { authorId: clientId }, { created_at: "now" }]) {
      expect(await performCommentMutation({ rpc }, "create", { requestId, clientId, body: "ok", ...extra })).toEqual({ kind: "invalid" });
    }
    expect(rpc).not.toHaveBeenCalled();
  });
  it("preserves content and immutable intent on uncertain transport retry", async () => {
    const rpc = vi.fn().mockRejectedValueOnce(new Error("lost")).mockResolvedValue({ data: { request_id: requestId, comment }, error: null });
    const intent = { requestId, clientId, body: "Texto\nexacto" };
    expect(await performCommentMutation({ rpc }, "create", intent)).toMatchObject({ kind: "error", retry: true });
    expect(await performCommentMutation({ rpc }, "create", intent)).toEqual({ kind: "success", comment });
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
    expect(rpc.mock.calls[0]).toEqual(["create_client_comment", { p_request_id: requestId, p_client_id: clientId, p_body: intent.body }]);
  });
  it("checks receipts match request, client, content and archive operation", async () => {
    for (const data of [{ request_id: clientId, comment }, { request_id: requestId, comment: { ...comment, client_id: requestId } },
      { request_id: requestId, comment: { ...comment, body: "Changed" } }]) {
      expect(await performCommentMutation({ rpc: vi.fn().mockResolvedValue({ data, error: null }) }, "create", { requestId, clientId, body: comment.body }))
        .toMatchObject({ kind: "error", retry: true });
    }
    expect(await performCommentMutation({ rpc: vi.fn().mockResolvedValue({ data: { request_id: requestId, comment }, error: null }) }, "archive", { requestId, clientId, commentId: requestId }))
      .toMatchObject({ kind: "error", retry: true });
  });
  it("keeps forbidden/missing/idempotency errors definite and incomplete results uncertain", async () => {
    for (const code of ["42501", "P0002", "22023"]) expect(await performCommentMutation({ rpc: vi.fn().mockResolvedValue({ error: { code } }) },
      "create", { requestId, clientId, body: "ok" })).toMatchObject({ kind: "error", retry: false });
    expect(await performCommentMutation({ rpc: vi.fn().mockResolvedValue({ error: { code: "PT409", message: "incomplete_request" }, status: 409 }) },
      "create", { requestId, clientId, body: "ok" })).toMatchObject({ kind: "error", retry: true });
  });
  it("does not turn read errors, malformed pages or a different client into empty history", async () => {
    for (const result of [{ error: { code: "42501" } }, { data: {} }, { data: { rows: [{ ...comment, client_id: requestId }], next: null } }]) {
      expect(await readCommentPage({ rpc: vi.fn().mockResolvedValue(result) }, { clientId, archived: false })).toEqual({ kind: "unavailable" });
    }
  });
  it("retains microseconds in a cursor and exposes pagination", async () => {
    const cursor = { at: comment.sort_at, id: comment.id };
    const rpc = vi.fn().mockResolvedValue({ data: { rows: [comment], next: cursor }, error: null });
    expect(await readCommentPage({ rpc }, { clientId, archived: false, cursor })).toEqual({ kind: "found", rows: [comment], next: cursor });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_before_at: cursor.at, p_before_id: cursor.id });
  });
  it("validates legacy absence of fabricated author/date and archive metadata pairs", () => {
    expect(isComment({ ...comment, legacy: true, author_id: null, author_email: null, created_at: null, imported_at: comment.sort_at })).toBe(true);
    expect(isComment({ ...comment, legacy: true })).toBe(false);
    expect(isComment({ ...comment, archived_at: comment.sort_at })).toBe(false);
  });
  it("handles actual SDK HTTP envelopes and retries the same serialized intention after a lost response", async () => {
    const requests: { url: string; body: unknown }[] = [];
    let attempt = 0;
    const client = createClient("https://local.invalid", "local-fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, init) => {
        requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
        attempt++;
        if (attempt === 1) throw new TypeError("Response lost");
        return new Response(JSON.stringify({ request_id: requestId, comment }), { headers: { "Content-Type": "application/json" } });
      } },
    });
    const intent = { requestId, clientId, body: comment.body };
    expect(await performCommentMutation(client, "create", intent)).toMatchObject({ kind: "error", retry: true });
    expect(await performCommentMutation(client, "create", intent)).toEqual({ kind: "success", comment });
    expect(requests[0]).toEqual(requests[1]);
    expect(requests[0].url).toBe("https://local.invalid/rest/v1/rpc/create_client_comment");
    expect(requests[0].body).toEqual({ p_request_id: requestId, p_client_id: clientId, p_body: comment.body });
  });
  it.each([409, 403, 500])("classifies actual SDK HTTP %s response without disclosing internals", async (status) => {
    const client = createClient("https://local.invalid", "local-fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async () => new Response(JSON.stringify({ code: status === 409 ? "PT409" : "42501",
        message: status === 409 ? "incomplete_request" : "private internals" }), { status, headers: { "Content-Type": "application/json" } }) },
    });
    const result = await performCommentMutation(client, "create", { requestId, clientId, body: comment.body });
    expect(result).toMatchObject({ kind: "error", retry: status !== 403 });
    expect(JSON.stringify(result)).not.toContain("private internals");
  });
});
