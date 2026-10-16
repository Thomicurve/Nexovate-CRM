"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { archiveClientComment, createClientComment, loadClientComments } from "@/app/(crm)/clientes/comment-actions";
import { validCommentText, type ArchiveCommentIntent, type ClientComment, type CommentCursor, type CommentResult, type CreateCommentIntent } from "@/lib/comments/model";
import { CLIENT_TIME_ZONE } from "@/lib/clients/dates";
import { ClientConfirmation } from "./client-confirmation";
import { useClientFormExit, type ExitGuard } from "./client-form-exit";
import styles from "./clients.module.css";

const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: CLIENT_TIME_ZONE,
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const date = (value: string) => formatter.format(new Date(value)).replace(",", "");
function focusIfUnmoved(source: Element | null, target: HTMLElement | null) {
  const active = document.activeElement;
  if (active === source || active === document.body || active?.matches("dialog")) target?.focus();
}
type ReadState = { status: "loading" | "found" | "error"; rows: ClientComment[]; next: CommentCursor | null; failedCursor?: CommentCursor | null };
type Mutation = { intent: CreateCommentIntent | ArchiveCommentIntent; operation: "create" | "archive";
  phase: "pending" | "uncertain" | "error"; message?: string };

export function ClientComments({ clientId, onRegisterExit, onLockChange }: {
  clientId: string; onRegisterExit?: (guard: ExitGuard | null) => void; onLockChange?: (locked: boolean) => void;
}) {
  const router = useRouter();
  const [archived, setArchived] = useState(false), [draft, setDraft] = useState("");
  const [read, setRead] = useState<ReadState>({ status: "loading", rows: [], next: null });
  const [userId, setUserId] = useState<string>(), [mutation, setMutation] = useState<Mutation | null>(null);
  const [notice, setNotice] = useState(""), [discard, setDiscard] = useState<{ leave: () => void } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null), heading = useRef<HTMLHeadingElement>(null), toggle = useRef<HTMLButtonElement>(null);
  const generation = useRef(0), contextEpoch = useRef(0), mounted = useRef(false), activeMutation = useRef<Mutation | null>(null);
  const locked = mutation?.phase === "pending" || mutation?.phase === "uncertain";
  const exitState = useRef({ dirty: false, locked: false });
  useLayoutEffect(() => { exitState.current = { dirty: Boolean(draft), locked }; });
  const guard = useCallback<ExitGuard>((leave) => {
    if (exitState.current.locked) return;
    if (exitState.current.dirty) setDiscard({ leave }); else leave();
  }, []);
  useLayoutEffect(() => { onRegisterExit?.(guard); return () => onRegisterExit?.(null); }, [guard, onRegisterExit]);
  useLayoutEffect(() => { onLockChange?.(Boolean(locked)); }, [locked, onLockChange]);
  useClientFormExit(Boolean(draft), Boolean(locked), guard, (href) => {
    if (/^https?:/.test(href)) location.assign(href); else router.push(href);
  });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback(async (cursor: CommentCursor | null = null) => {
    const current = ++generation.current;
    setRead((previous) => ({ status: "loading", rows: cursor ? previous.rows : [], next: null, failedCursor: cursor }));
    try {
      const result = await loadClientComments({ clientId, archived, cursor });
      if (!mounted.current || current !== generation.current) return false;
      setUserId(result.userId);
      if (result.kind !== "found") { setRead((previous) => ({ ...previous, status: "error" })); return true; }
      setRead((previous) => ({ status: "found", rows: cursor ? [...previous.rows, ...result.rows.filter((row) => !previous.rows.some((existing) => existing.id === row.id))] : result.rows, next: result.next }));
      return true;
    } catch {
      if (!mounted.current || current !== generation.current) return false;
      setRead((previous) => ({ ...previous, status: "error" }));
      return true;
    }
  }, [clientId, archived]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; };
  }, [load]);
  const previousClient = useRef(clientId);
  useLayoutEffect(() => {
    if (previousClient.current === clientId) return;
    previousClient.current = clientId;
    generation.current++; contextEpoch.current++; activeMutation.current = null;
    setArchived(false); setDraft(""); setMutation(null); setNotice(""); setUserId(undefined);
  }, [clientId]);
  const previousTab = useRef(archived);
  useLayoutEffect(() => {
    if (previousTab.current !== archived) { previousTab.current = archived; toggle.current?.focus(); }
  }, [archived]);
  async function mutate(next: Mutation) {
    if (activeMutation.current?.phase === "pending") return;
    const currentClient = clientId, currentEpoch = contextEpoch.current, initiatingControl = document.activeElement;
    const pending = { ...next, phase: "pending" as const };
    activeMutation.current = pending; setMutation(pending); setNotice("");
    let result: CommentResult;
    try {
      result = next.operation === "create" ? await createClientComment(next.intent) : await archiveClientComment(next.intent);
    } catch { result = { kind: "error", retry: true, message: "No podemos confirmar la operación. Reintentá la misma intención antes de continuar." }; }
    if (!mounted.current || previousClient.current !== currentClient || currentEpoch !== contextEpoch.current) return;
    if (result.kind === "success") {
      activeMutation.current = null; setMutation(null);
      if (next.operation === "create") setDraft("");
      setNotice(next.operation === "create" ? "Comentario agregado." : "Comentario archivado.");
      // A replay receipt may predate a later archive. Always reconcile by reading.
      const accepted = await load();
      if (accepted && mounted.current && previousClient.current === currentClient)
        focusIfUnmoved(initiatingControl, next.operation === "create" ? input.current : heading.current);
    } else {
      const failed = { ...next, phase: result.kind === "error" && result.retry ? "uncertain" as const : "error" as const,
        message: result.kind === "error" ? result.message : "La solicitud no es válida. Revisá el comentario." };
      activeMutation.current = failed; setMutation(failed);
    }
  }
  function submit() {
    if (locked || !validCommentText(draft)) return;
    void mutate({ operation: "create", intent: Object.freeze({ requestId: crypto.randomUUID(), clientId, body: draft }), phase: "pending" });
  }
  const switchTab = () => guard(() => { generation.current++; setDraft(""); setNotice(""); setMutation(null); activeMutation.current = null; setArchived(!archived); });
  const tabButton = <button ref={toggle} type="button" className={styles.commentSecondary} disabled={Boolean(locked)} onClick={switchTab}>
    {archived ? "Volver a comentarios" : "Ver archivados"}</button>;
  return <section className={styles.comments} aria-label="Historial del cliente" aria-busy={read.status === "loading" || mutation?.phase === "pending"}>
    {archived ? <>{tabButton}<h3 ref={heading} tabIndex={-1}>Comentarios archivados</h3></> :
      <div className={styles.commentsHeader}><h3 ref={heading} tabIndex={-1}>Comentarios</h3>{tabButton}</div>}
    <p className={styles.commentHelp}>{archived ? "Conservamos el texto y los datos originales. Horario de Buenos Aires." : "Más recientes primero. Horario de Buenos Aires."}</p>
    {!archived && <form className={styles.commentComposer} onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <label htmlFor="new-client-comment">Nuevo comentario</label>
      <textarea ref={input} id="new-client-comment" value={draft} readOnly={Boolean(locked)} aria-describedby="comment-limit" aria-invalid={[...draft].length > 5000}
        onChange={(event) => { setDraft(event.target.value); if (mutation?.phase === "error") { setMutation(null); activeMutation.current = null; } }} />
      <p id="comment-limit" className={styles.commentHelp}>{[...draft].length}/5000 caracteres.</p>
      <div className={styles.commentComposerActions}><span className={styles.commentHelp}>Se publica con tu cuenta autenticada.</span>
        <button className="ui-button" type="submit" disabled={Boolean(locked) || !validCommentText(draft)}>{mutation?.phase === "pending" && mutation.operation === "create" ? "Agregando…" : "Agregar comentario"}</button></div>
    </form>}
    {mutation?.phase === "pending" && mutation.operation === "archive" && <p role="status">Archivando comentario…</p>}
    {mutation?.message && <div role="alert" className={styles.commentFeedback}><p>{mutation.message}</p>
      <button type="button" className={styles.commentSecondary} onClick={() => void mutate(mutation)}>Reintentar operación</button></div>}
    {notice && <p role="status">{notice}</p>}
    {read.status === "loading" && <p role="status">{read.rows.length ? "Cargando más comentarios…" : "Cargando comentarios…"}</p>}
    {read.status === "error" && <div role="alert" className={styles.commentFeedback}><p>No pudimos cargar los comentarios. Reintentá para consultar el historial.</p>
      <button type="button" className={styles.commentSecondary} onClick={() => void load(read.failedCursor)}>Reintentar lectura</button></div>}
    {read.status === "found" && !read.rows.length && <p>{archived ? "No hay comentarios archivados." : "Todavía no hay comentarios."}</p>}
    <ol className={styles.commentList}>{read.rows.map((row) => <li key={row.id} className={`${styles.commentRow} ${row.legacy ? styles.legacyComment : ""}`}>
      <div className={styles.commentIdentity}><strong>{row.legacy ? "Nota anterior" : row.author_email || "Socio de CRM"}</strong>
        <p className={styles.commentHelp}>{row.legacy ? "Autor y fecha originales no registrados." : <time dateTime={row.created_at!}>{date(row.created_at!)}</time>}</p></div>
      {!archived && userId && (row.legacy || row.author_id === userId) && <button type="button" className={styles.commentArchive}
        disabled={Boolean(locked)} aria-label="Archivar comentario" onClick={() => void mutate({ operation: "archive",
          intent: Object.freeze({ requestId: crypto.randomUUID(), clientId, commentId: row.id }), phase: "pending" })}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="20" height="5" x="2" y="3" rx="1" /><path d="M4 8v12a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8M10 12h4" /></svg>
        <span className={styles.archiveTooltip}>Archivar comentario</span></button>}
      <p className={styles.commentBody}>{row.body}</p>
      {archived && <p className={styles.commentHelp}>Archivado por {row.archived_by_email || "Socio de CRM"} · <time dateTime={row.archived_at!}>{date(row.archived_at!)}</time> (Buenos Aires)</p>}
    </li>)}</ol>
    {read.status === "found" && read.next && <button type="button" className={styles.commentSecondary} disabled={Boolean(locked)}
      onClick={async (event) => { const source = event.currentTarget; if (await load(read.next)) focusIfUnmoved(source, heading.current); }}>Cargar más comentarios</button>}
    {discard && <ClientConfirmation title="¿Descartar el comentario?" confirmLabel="Descartar comentario" cancelLabel="Seguir escribiendo"
      onCancel={() => setDiscard(null)} onConfirm={() => { const leave = discard.leave; setDiscard(null); setDraft(""); leave(); }}>
      <p>Tenés un comentario sin enviar. Podés seguir escribiendo antes de salir.</p></ClientConfirmation>}
  </section>;
}
