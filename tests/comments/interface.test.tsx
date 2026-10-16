import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientComments } from "@/components/clients/client-comments";
import { ClientDetails } from "@/components/clients/client-details";
import { confirmed } from "../clients/fixture";
import type { ClientComment } from "@/lib/comments/model";
const f = vi.hoisted(() => ({ load: vi.fn(), create: vi.fn(), archive: vi.fn(), push: vi.fn() }));
vi.mock("@/app/(crm)/clientes/comment-actions", () => ({ loadClientComments: f.load, createClientComment: f.create, archiveClientComment: f.archive }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: f.push }) }));
const clientId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", actor = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const row: ClientComment = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", client_id: clientId, body: "Texto\ncompleto", legacy: false,
  author_id: actor, author_email: "socio@example.test", created_at: "2026-10-16T15:00:00.123456+00:00", imported_at: null,
  sort_at: "2026-10-16T15:00:00.123456+00:00", archived_at: null, archived_by: null, archived_by_email: null };
describe("comment interface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    f.load.mockResolvedValue({ kind: "found", rows: [row], next: null, userId: actor });
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
  });
  it("shows author, Buenos Aires date, full text and an accessible icon action", async () => {
    render(<ClientComments clientId={clientId} />);
    expect(await screen.findByText("socio@example.test")).toBeVisible();
    expect(screen.getByText("16/10/2026 12:00")).toBeVisible();
    expect(screen.getByText(/Texto\s+completo/)).toHaveTextContent("Texto completo");
    const archive = screen.getByRole("button", { name: "Archivar comentario" });
    expect(archive.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(archive.querySelector("span")).toHaveTextContent("Archivar comentario");
  });
  it("hides archive for other authors, allows legacy and does not invent its date", async () => {
    f.load.mockResolvedValue({ kind: "found", userId: actor, next: null, rows: [
      { ...row, author_id: clientId }, { ...row, id: clientId, body: "Histórico", legacy: true, author_id: null, author_email: null, created_at: null, imported_at: row.sort_at }] });
    render(<ClientComments clientId={clientId} />);
    await screen.findByText("Nota anterior");
    expect(screen.getAllByRole("button", { name: "Archivar comentario" })).toHaveLength(1);
    expect(screen.getByText("Autor y fecha originales no registrados.")).toBeVisible();
  });
  it("freezes an uncertain draft and retries the identical intention before reconciling a fresh page", async () => {
    f.create.mockResolvedValueOnce({ kind: "error", retry: true, message: "Resultado incierto" }).mockResolvedValueOnce({ kind: "success", comment: row });
    render(<ClientComments clientId={clientId} />);
    await screen.findByText("socio@example.test");
    const user = userEvent.setup(), input = screen.getByRole("textbox", { name: "Nuevo comentario" });
    await user.type(input, "Mi texto{Enter}exacto");
    await user.click(screen.getByRole("button", { name: "Agregar comentario" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Resultado incierto");
    expect(input).toHaveAttribute("readonly");
    await user.type(input, "no cambiar");
    await user.click(screen.getByRole("button", { name: "Reintentar operación" }));
    expect(f.create.mock.calls[0]).toEqual(f.create.mock.calls[1]);
    expect(f.create.mock.calls[0][0].body).toBe("Mi texto\nexacto");
    expect(input).toHaveValue("");
    expect(f.load).toHaveBeenCalledTimes(2);
  });
  it("shows a failed read as an error with retry and consults archive without a composer", async () => {
    f.load.mockResolvedValueOnce({ kind: "unavailable", userId: actor }).mockResolvedValueOnce({ kind: "found", userId: actor, rows: [], next: null });
    render(<ClientComments clientId={clientId} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar");
    expect(screen.queryByText("Todavía no hay comentarios.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar lectura" }));
    await screen.findByText("Todavía no hay comentarios.");
    await userEvent.click(screen.getByRole("button", { name: "Ver archivados" }));
    await screen.findByRole("heading", { name: "Comentarios archivados" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver a comentarios" })).toHaveFocus();
  });
  it("ignores an old response after changing client", async () => {
    let resolve!: (value: unknown) => void;
    f.load.mockImplementationOnce(() => new Promise((done) => { resolve = done; })).mockResolvedValue({ kind: "found", rows: [], next: null, userId: actor });
    const view = render(<ClientComments clientId={clientId} />);
    await waitFor(() => expect(f.load).toHaveBeenCalledOnce());
    view.rerender(<ClientComments clientId={actor} />);
    await screen.findByText("Todavía no hay comentarios.");
    await act(async () => resolve({ kind: "found", rows: [row], next: null, userId: actor }));
    expect(screen.queryByText("socio@example.test")).not.toBeInTheDocument();
  });
  it("does not duplicate a pending submit and counts astral characters as whole characters", async () => {
    let finish!: (value: unknown) => void;
    f.create.mockImplementation(() => new Promise((done) => { finish = done; }));
    const lock = vi.fn(); render(<ClientComments clientId={clientId} onLockChange={lock} />);
    await screen.findByText("socio@example.test");
    const input = screen.getByRole("textbox", { name: "Nuevo comentario" });
    fireEvent.change(input, { target: { value: "🧉".repeat(5000) } });
    expect(screen.getByText("5000/5000 caracteres.")).toBeVisible();
    const button = screen.getByRole("button", { name: "Agregar comentario" });
    expect(button).toBeEnabled();
    await userEvent.dblClick(button); expect(f.create).toHaveBeenCalledOnce();
    expect(lock).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("button", { name: "Ver archivados" })).toBeDisabled();
    await act(async () => finish({ kind: "error", retry: false, message: "Revisá el texto" }));
    expect(input).not.toHaveAttribute("readonly");
    fireEvent.change(input, { target: { value: "🧉".repeat(5001) } });
    expect(screen.getByRole("button", { name: "Agregar comentario" })).toBeDisabled();
  });
  it("retains paged rows on a failed next page and retries the exact microsecond cursor", async () => {
    const cursor = { at: row.sort_at, id: row.id };
    f.load.mockResolvedValueOnce({ kind: "found", rows: [row], next: cursor, userId: actor })
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ kind: "found", rows: [{ ...row, id: actor, body: "Segunda página" }], next: null, userId: actor });
    render(<ClientComments clientId={clientId} />);
    await userEvent.click(await screen.findByRole("button", { name: "Cargar más comentarios" }));
    await screen.findByRole("alert");
    expect(screen.getByText(/Texto\s+completo/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar lectura" }));
    expect(await screen.findByText("Segunda página")).toBeVisible();
    expect(f.load.mock.calls[1]).toEqual(f.load.mock.calls[2]);
    expect(f.load.mock.calls[2][0].cursor).toEqual(cursor);
    expect(screen.queryByRole("button", { name: "Cargar más comentarios" })).not.toBeInTheDocument();
  });
  it("preserves archive intention through uncertain retry and refreshes instead of trusting an old receipt", async () => {
    f.archive.mockResolvedValueOnce({ kind: "error", retry: true, message: "Archivo incierto" }).mockResolvedValueOnce({ kind: "success", comment: row });
    f.load.mockResolvedValueOnce({ kind: "found", rows: [row], next: null, userId: actor }).mockResolvedValue({ kind: "found", rows: [], next: null, userId: actor });
    render(<ClientComments clientId={clientId} />);
    await userEvent.click(await screen.findByRole("button", { name: "Archivar comentario" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Archivo incierto");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar operación" }));
    expect(await screen.findByText("Todavía no hay comentarios.")).toBeVisible();
    expect(f.archive.mock.calls[0]).toEqual(f.archive.mock.calls[1]);
    expect(screen.queryByText("socio@example.test")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comentarios" })).toHaveFocus();
  });
  it("guards draft tab switching and browser exit without calling an action", async () => {
    render(<ClientComments clientId={clientId} />);
    await screen.findByText("socio@example.test");
    await userEvent.type(screen.getByRole("textbox", { name: "Nuevo comentario" }), "Sin enviar");
    const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
    const switcher = screen.getByRole("button", { name: "Ver archivados" }); await userEvent.click(switcher);
    expect(await screen.findByRole("dialog", { name: "¿Descartar el comentario?" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Seguir escribiendo" }));
    expect(screen.getByRole("textbox")).toHaveValue("Sin enviar"); expect(switcher).toHaveFocus();
    await userEvent.click(switcher); await userEvent.click(screen.getByRole("button", { name: "Descartar comentario" }));
    expect(await screen.findByRole("heading", { name: "Comentarios archivados" })).toBeVisible();
    expect(f.create).not.toHaveBeenCalled();
  });
  it.each(["close", "edit", "escape"])("guards %s and cancels only the nested confirmation on Escape", async (action) => {
    const opener = document.createElement("button"); document.body.append(opener);
    const onClose = vi.fn(), onEdit = vi.fn();
    const view = render(<ClientDetails client={confirmed} returnTo="/clientes?vista=tabla" opener={opener} onClose={onClose} onEdit={onEdit} />);
    await screen.findByText("socio@example.test");
    const close = screen.getByRole("button", { name: "Cerrar" }); expect(close).toHaveFocus();
    const input = screen.getByRole("textbox", { name: "Nuevo comentario" }); fireEvent.change(input, { target: { value: "No perder" } });
    expect(input).toHaveValue("No perder");
    const activate = async () => {
      if (action === "escape") fireEvent.keyDown(input, { key: "Escape" });
      else await userEvent.click(screen.getByRole(action === "edit" ? "link" : "button", { name: action === "edit" ? "Editar Confirmado" : "Cerrar" }));
    };
    await activate();
    expect(onClose).not.toHaveBeenCalled(); expect(onEdit).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog", { name: "¿Descartar el comentario?" })).toBeVisible();
    // jsdom has no native Escape-to-cancel implementation; exercise that event.
    fireEvent(screen.getByRole("dialog", { name: "¿Descartar el comentario?" }), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog", { name: "¿Descartar el comentario?" })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled(); expect(onEdit).not.toHaveBeenCalled();
    expect(input).toHaveValue("No perder");
    await activate(); await userEvent.click(screen.getByRole("button", { name: "Descartar comentario" }));
    expect(action === "edit" ? onEdit : onClose).toHaveBeenCalledOnce();
    view.unmount(); await act(async () => {});
    if (action !== "edit") expect(opener).toHaveFocus();
    opener.remove();
  });
  it("ignores an obsolete mutation after changing clients and preserves the new client's draft", async () => {
    let finish!: (value: unknown) => void;
    f.create.mockImplementation(() => new Promise((done) => { finish = done; }));
    const view = render(<ClientComments clientId={clientId} />);
    await screen.findByText("socio@example.test");
    await userEvent.type(screen.getByRole("textbox"), "Primero");
    await userEvent.click(screen.getByRole("button", { name: "Agregar comentario" }));
    view.rerender(<ClientComments clientId={actor} />);
    await screen.findByText("socio@example.test");
    await userEvent.type(screen.getByRole("textbox"), "Segundo");
    await act(async () => finish({ kind: "success", comment: row }));
    expect(screen.getByRole("textbox")).toHaveValue("Segundo");
    expect(screen.queryByText("Comentario agregado.")).not.toBeInTheDocument();
  });
  it("does not move focus when an old post-archive reload finishes in a different tab", async () => {
    let finish!: (value: unknown) => void;
    f.archive.mockResolvedValue({ kind: "success", comment: row });
    f.load.mockResolvedValueOnce({ kind: "found", rows: [row], next: null, userId: actor })
      .mockImplementationOnce(() => new Promise((done) => { finish = done; }))
      .mockResolvedValue({ kind: "found", rows: [], next: null, userId: actor });
    render(<ClientComments clientId={clientId} />);
    await userEvent.click(await screen.findByRole("button", { name: "Archivar comentario" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver archivados" }));
    const back = screen.getByRole("button", { name: "Volver a comentarios" }); expect(back).toHaveFocus();
    await act(async () => finish({ kind: "found", rows: [], next: null, userId: actor }));
    expect(back).toHaveFocus();
  });
  it("does not move focus when an old next-page response finishes in a different tab", async () => {
    let finish!: (value: unknown) => void;
    f.load.mockResolvedValueOnce({ kind: "found", rows: [row], next: { at: row.sort_at, id: row.id }, userId: actor })
      .mockImplementationOnce(() => new Promise((done) => { finish = done; }))
      .mockResolvedValue({ kind: "found", rows: [], next: null, userId: actor });
    render(<ClientComments clientId={clientId} />);
    await userEvent.click(await screen.findByRole("button", { name: "Cargar más comentarios" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver archivados" }));
    const back = screen.getByRole("button", { name: "Volver a comentarios" }); expect(back).toHaveFocus();
    await act(async () => finish({ kind: "found", rows: [row], next: null, userId: actor }));
    expect(back).toHaveFocus();
  });
});
