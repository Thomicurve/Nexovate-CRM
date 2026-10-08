"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, pointerWithin, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { moveClient } from "@/app/(crm)/clientes/actions";
import { beginMove, finishMove, retryMove, type BoardMove, type MoveResult } from "@/lib/clients/moves";
import { STATUSES, type Client, type ClientStatus } from "@/lib/clients/model";
import { CLIENT_TIME_ZONE } from "@/lib/clients/dates";
import styles from "./clients.module.css";

const colors = ["#85B6F5", "#B8AEEC", "#92CDB4", "#B8C4D5", "#E8A6AD", "#99C9DD"];
const date = new Intl.DateTimeFormat("es-AR", { timeZone: CLIENT_TIME_ZONE, dateStyle: "short", timeStyle: "short" });
const columnId = (status: ClientStatus) => `column-${status}`;
const keyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  if (!["ArrowLeft", "ArrowRight"].includes(event.code)) return;
  const current = context.over?.data.current?.status ?? context.active?.data.current?.status;
  const index = STATUSES.indexOf(current), target = STATUSES[index + (event.code === "ArrowRight" ? 1 : -1)];
  const rect = target && context.droppableRects.get(columnId(target));
  if (!rect || !context.collisionRect) return;
  event.preventDefault();
  return { x: rect.left + rect.width / 2 - context.collisionRect.width / 2,
    y: rect.top + 80 - context.collisionRect.height / 2 };
};

export function ClientKanban({ rows, returnTo, onLock }: { rows: Client[]; returnTo: string; onLock: (locked: boolean) => void }) {
  const router = useRouter();
  const [board, setBoard] = useState<BoardMove>({ rows, intent: null, original: null, pending: false, result: null });
  const current = useRef(board), [seenRows, setSeenRows] = useState(rows);
  const container = useRef<HTMLElement>(null), focusAfter = useRef<string | null>(null);
  const [visible, setVisible] = useState<ClientStatus>("Contactado");
  useLayoutEffect(() => {
    current.current = board;
    if (!board.pending && focusAfter.current) {
      const target = board.intent ? container.current?.querySelector<HTMLButtonElement>("[data-retry]") :
        container.current?.querySelector<HTMLButtonElement>(`[data-client="${focusAfter.current}"] button`);
      (target ?? container.current)?.focus(); focusAfter.current = null;
    }
  }, [board]);
  // New server snapshots cannot replace an in-flight or uncertain intention.
  // After settlement refresh produces the canonical filtered page and count.
  if (rows !== seenRows) {
    setSeenRows(rows);
    if (!board.intent) setBoard({ ...board, rows });
  }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates, scrollBehavior: "auto" }));
  const apply = (next: BoardMove) => { current.current = next; setBoard(next); onLock(Boolean(next.intent)); };
  const submit = async (next: BoardMove) => {
    if (!next.intent) return;
    focusAfter.current = next.intent.clientId;
    apply(next);
    let result: MoveResult;
    try { result = await moveClient(next.intent); }
    catch { result = { kind: "error", retry: true, message: "No podemos confirmar el cambio. Reintentá el mismo movimiento." }; }
    apply(finishMove(current.current, result));
    if (result.kind === "success" || result.kind === "conflict") router.refresh();
  };
  const end = ({ active, over }: DragEndEvent) => {
    const next = beginMove(current.current, String(active.id), over?.data.current?.status ?? null, crypto.randomUUID());
    if (next !== current.current) void submit(next);
  };
  const locked = Boolean(board.intent);
  return <section ref={container} tabIndex={-1} aria-label="Kanban de clientes" className={styles.kanbanRegion}>
    <div className={`${styles.field} ${styles.visibleState}`}><label htmlFor="visible-status">Estado visible</label>
      <select id="visible-status" value={visible} disabled={locked} onChange={(event) => setVisible(event.target.value as ClientStatus)}>
        {STATUSES.map((status) => <option key={status} value={status}>{status} · {board.rows.filter((row) => row.status === status).length}</option>)}
      </select><p className={styles.hint}>Elegí cualquier estado para ver su columna.</p></div>
    <p className={styles.hint}>Los conteos corresponden a los clientes de esta página.</p>
    <p id="move-instructions" className={styles.srOnly}>Para cambiar el estado, presioná Espacio o Enter, usá las flechas izquierda y derecha y confirmá con Espacio o Enter. Escape cancela. También podés editar el cliente.</p>
    {board.pending && <p role="status">Guardando cambio de estado…</p>}
    {board.result?.kind === "success" && <p role="status">Cambio de estado guardado.</p>}
    {board.result?.kind === "error" && <div className={styles.actions}><p role="alert" className={styles.error}>{board.result.message}</p>
      {board.result.retry && <button type="button" data-retry onClick={() => void submit(retryMove(current.current))}>Intentar de nuevo</button>}</div>}
    {board.result?.kind === "conflict" && <div className={styles.actions}>
      <p role="alert" className={styles.error}>El cliente cambió mientras lo movías. Mostramos su versión confirmada.</p>
      <Link href={`/clientes/${board.result.confirmed.id}/editar?returnTo=${encodeURIComponent(returnTo)}`}>Volver a editar</Link></div>}
    <DndContext sensors={sensors} collisionDetection={(args) => args.pointerCoordinates ? pointerWithin(args) : closestCenter(args)}
      onDragEnd={end} accessibility={{ screenReaderInstructions: { draggable: "Para mover, presioná Enter o Espacio. Usá izquierda o derecha para elegir columna. Enter o Espacio confirma, Escape cancela." },
        announcements: { onDragStart: ({ active }) => `Seleccionaste ${active.data.current?.name}.`,
          onDragOver: ({ over }) => over ? `Destino: ${over.data.current?.status}.` : "Fuera de las columnas.",
          onDragEnd: ({ over }) => over ? `Soltaste en ${over.data.current?.status}.` : "Movimiento cancelado.",
          onDragCancel: () => "Movimiento cancelado. El estado se conserva." } }}>
      <div className={styles.board}>{STATUSES.map((status) => <Column key={status} status={status} visible={visible === status}
        rows={board.rows.filter((row) => row.status === status)} locked={locked} returnTo={returnTo} />)}</div>
    </DndContext>
  </section>;
}

function Column({ status, rows, visible, locked, returnTo }: { status: ClientStatus; rows: Client[]; visible: boolean; locked: boolean; returnTo: string }) {
  const { setNodeRef } = useDroppable({ id: columnId(status), data: { status }, disabled: locked });
  return <section ref={setNodeRef} className={`${styles.column} ${visible ? styles.visibleColumn : ""}`} data-column={status}>
    <header><h2>{status}</h2><span>{rows.length} {rows.length === 1 ? "cliente" : "clientes"}</span></header>
    {rows.map((row) => <Card key={row.id} client={row} locked={locked} returnTo={returnTo} />)}
  </section>;
}
function Card({ client, locked, returnTo }: { client: Client; locked: boolean; returnTo: string }) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: client.id, data: { status: client.status, name: client.name }, disabled: locked });
  return <article ref={setNodeRef} className={styles.card} data-client={client.id} style={{
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, zIndex: isDragging ? 1 : undefined }}>
    <h3>{client.name}</h3><p className={styles.cardCompany}>{client.company || "Sin empresa"}</p>
    <p>Rubro: {client.rubro || "Sin informar"}</p><p>Contacto: {date.format(new Date(client.contact_at))}</p>
    {client.meeting_at && <p>Cita: {date.format(new Date(client.meeting_at))}</p>}
    <p style={{ color: colors[STATUSES.indexOf(client.status)] }}>{client.status}</p>
    <div className={styles.cardActions}><Link aria-label={`Editar ${client.name}`} aria-disabled={locked}
      tabIndex={locked ? -1 : undefined} onClick={(event) => { if (locked) event.preventDefault(); }}
      href={`/clientes/${client.id}/editar?returnTo=${encodeURIComponent(returnTo)}`}>Editar</Link>
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} disabled={locked}
        aria-describedby="move-instructions" aria-label={`Cambiar estado de ${client.name}`}>Cambiar estado</button></div>
  </article>;
}
