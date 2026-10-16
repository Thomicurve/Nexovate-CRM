import { beforeEach, describe, expect, it, vi } from "vitest";
import { archiveClientComment, createClientComment, loadClientComments } from "@/app/(crm)/clientes/comment-actions";
const f = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth/require-member", () => ({ requireMember: f.guard }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
const clientId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const requestId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
describe("member guarded comment actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    f.guard.mockResolvedValue({ client: { rpc: f.rpc }, userId: clientId });
    f.rpc.mockResolvedValue({ data: { rows: [], next: null }, error: null });
  });
  it("returns authenticated UUID for UI permission checks beside an empty page", async () => {
    expect(await loadClientComments({ clientId, archived: false })).toEqual({ kind: "found", rows: [], next: null, userId: clientId });
    expect(f.guard).toHaveBeenCalledOnce();
  });
  it("guards every entry point before parsing or querying", async () => {
    f.guard.mockRejectedValue(new Error("login required"));
    for (const action of [loadClientComments, createClientComment, archiveClientComment]) await expect(action(null)).rejects.toThrow("login required");
    expect(f.rpc).not.toHaveBeenCalled();
    expect(f.revalidate).not.toHaveBeenCalled();
  });
  it("invalidates only client data after a confirmed receipt", async () => {
    const comment = { id: requestId, client_id: clientId, body: "New", legacy: false, author_id: clientId,
      author_email: "first@example.test", created_at: "2026-10-16T15:00:00Z", imported_at: null, sort_at: "2026-10-16T15:00:00Z",
      archived_by: null, archived_by_email: null, archived_at: null };
    f.rpc.mockResolvedValue({ data: { request_id: requestId, comment }, error: null });
    expect((await createClientComment({ requestId, clientId, body: "New" })).kind).toBe("success");
    expect(f.revalidate.mock.calls).toEqual([["/clientes"]]);
    f.revalidate.mockClear();
    f.rpc.mockRejectedValue(new Error("network"));
    expect(await archiveClientComment({ requestId, clientId, commentId: requestId })).toMatchObject({ kind: "error", retry: true });
    expect(f.revalidate).not.toHaveBeenCalled();
  });
});
