"use client";

import { LoadingLink as Link } from "@/components/ui/loading-navigation";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, pointerWithin, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { useNotification } from "@/components/ui/notifications";
import { moveClient } from "@/app/(crm)/clientes/actions";
import { beginMove, finishMove, retryMove, type BoardMove, type MoveResult } from "@/lib/clients/moves";
import { STATUSES, type Client, type ClientStatus } from "@/lib/clients/model";
import { CLIENT_TIME_ZONE } from "@/lib/clients/dates";
import { KANBAN_STATUSES, readColumnOrder, reorderColumn, saveColumnOrder } from "@/lib/clients/column-order";
import { usePendingLoading } from "@/components/ui/global-loading";
import styles from "./clients.module.css";

const colors = ["#85B6F5", "#B8AEEC", "#92CDB4", "#B8C4D5", "#E8A6AD", "#99C9DD"];
const date = new Intl.DateTimeFormat("es-AR", { timeZone: CLIENT_TIME_ZONE, dateStyle: "short", timeStyle: "short" });
const columnId = (status: ClientStatus) => `column-${status}`;
type EditCard = (client: Client, opener: HTMLElement) => void;

export function ClientKanban({ rows, returnTo, onLock, onEdit }: { rows: Client[]; returnTo: string; onLock: (locked: boolean) => void; onEdit: EditCard }) {
  const router = useRouter(), notify = useNotification();
  const [board, setBoard] = useState<BoardMove>({ rows, intent: null, original: null, pending: false, result: null });
  const [refreshPending, transition] = useTransition();
  usePendingLoading(board.pending || refreshPending);
  const current = useRef(board), [seenRows, setSeenRows] = useState(rows);
  const container = useRef<HTMLElement>(null), focusAfter = useRef<string | null>(null);
  const [visible, setVisible] = useState<ClientStatus>("Contactado");
  const [order, setOrder] = useState<ClientStatus[]>([...KANBAN_STATUSES]), [dragging, setDragging] = useState(false);
  const gesture = useRef(false), keyboardTarget = useRef<ClientStatus | null>(null);
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => { if (mounted) { const saved = readColumnOrder(); setOrder(saved); setVisible(saved[0]); } });
    return () => { mounted = false; };
  }, []);
  useLayoutEffect(() => {
    current.current = board;
    if (!board.pending && focusAfter.current) {
      const target = board.intent ? container.current?.querySelector<HTMLButtonElement>("[data-retry]") :
        container.current?.querySelector<HTMLButtonElement>(`[data-client="${focusAfter.current}"] [data-drag-handle]`);
      (target ?? container.current)?.focus(); focusAfter.current = null;
    }
  }, [board]);
  // New server snapshots cannot replace an in-flight or uncertain intention.
  // After settlement refresh produces the canonical filtered page and count.
  if (rows !== seenRows) {
    setSeenRows(rows);
    if (!board.intent) setBoard({ ...board, rows });
  }
  const keyboardCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.code)) return;
    const current = keyboardTarget.current ?? context.over?.data.current?.status ?? context.active?.data.current?.status;
    const target = order[order.indexOf(current) + (event.code === "ArrowRight" ? 1 : -1)];
    if (!target || !context.collisionRect) return;
    event.preventDefault(); keyboardTarget.current = target;
    if (window.matchMedia?.("(max-width: 768px)").matches) setVisible(target);
    const rect = context.droppableRects.get(columnId(target));
    // The logical keyboard destination also works when mobile hides other columns.
    return rect?.width ? { x: rect.left + rect.width / 2 - context.collisionRect.width / 2,
      y: rect.top + 80 - context.collisionRect.height / 2 } : { ...currentCoordinates, x: currentCoordinates.x + 1 };
  };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates, scrollBehavior: "auto" }));
  const apply = (next: BoardMove) => { current.current = next; setBoard(next); onLock(Boolean(next.intent) || gesture.current); };
  const submit = async (next: BoardMove) => {
    if (!next.intent) return;
    focusAfter.current = next.intent.clientId;
    apply(next);
    let result: MoveResult;
    try { result = await moveClient(next.intent); }
    catch { result = { kind: "error", retry: true, message: "No podemos confirmar el cambio. Reintentá el mismo movimiento." }; }
    apply(finishMove(current.current, result));
    if (result.kind === "success") notify("Estado actualizado", `${result.client.name} · ${result.client.status}`);
    if (result.kind === "success" || result.kind === "conflict") transition(() => router.refresh());
  };
  const release = () => { gesture.current = false; setDragging(false); keyboardTarget.current = null; onLock(Boolean(current.current.intent)); };
  const reorder = (from: ClientStatus, to: ClientStatus) => {
    if (current.current.intent || gesture.current || from === to) return;
    const next = reorderColumn(order, from, to); setOrder(next); saveColumnOrder(next);
  };
  const end = ({ active, over }: DragEndEvent) => {
    const target = keyboardTarget.current ?? over?.data.current?.status ?? null;
    release();
    if (active.data.current?.kind === "column") { if (target) reorder(active.data.current.status, target); return; }
    const next = beginMove(current.current, active.data.current?.clientId, target, crypto.randomUUID());
    if (next !== current.current) void submit(next);
  };
  const locked = Boolean(board.intent);
  return <section ref={container} tabIndex={-1} aria-label="Kanban de clientes" className={styles.kanbanRegion}>
    <div className={`${styles.field} ${styles.visibleState}`}><label htmlFor="visible-status">Estado visible</label>
    <select id="visible-status" value={visible} disabled={locked || dragging} onChange={(event) => setVisible(event.target.value as ClientStatus)}>
        {order.map((status) => <option key={status} value={status}>{status} · {board.rows.filter((row) => row.status === status).length}</option>)}
      </select><p className={styles.hint}>Elegí cualquier estado para ver su columna.</p></div>
    <p className={styles.hint}>Los conteos corresponden a los clientes de esta página.</p>
    <p id="move-instructions" className={styles.srOnly}>Para cambiar el estado, presioná Espacio o Enter, usá las flechas izquierda y derecha y confirmá con Espacio o Enter. Escape cancela. También podés editar el cliente.</p>
    {board.result?.kind === "error" && <div className={styles.actions}><p role="alert" className={styles.error}>{board.result.message}</p>
      {board.result.retry && <button type="button" data-retry onClick={() => void submit(retryMove(current.current))}>Intentar de nuevo</button>}</div>}
    {board.result?.kind === "conflict" && <div className={styles.actions}>
      <p role="alert" className={styles.error}>El cliente cambió mientras lo movías. Mostramos su versión confirmada.</p>
      <Link href={`/clientes/${board.result.confirmed.id}/editar?returnTo=${encodeURIComponent(returnTo)}`}>Volver a editar</Link></div>}
    <DndContext sensors={sensors} collisionDetection={(args) => {
      const columns = { ...args, droppableContainers: args.droppableContainers.filter((column) => column.data.current?.kind === "column") };
      return keyboardTarget.current ? [{ id: columnId(keyboardTarget.current) }] : args.pointerCoordinates ? pointerWithin(columns) : closestCenter(columns);
    }} onDragStart={({ active, activatorEvent }) => {
      gesture.current = true; setDragging(true); onLock(true);
      keyboardTarget.current = activatorEvent.type === "keydown" ? active.data.current?.status : null;
    }} onDragCancel={release} onDragEnd={end} accessibility={{ screenReaderInstructions: { draggable: "Para mover, presioná Enter o Espacio. Usá izquierda o derecha para elegir columna. Enter o Espacio confirma, Escape cancela." },
        announcements: { onDragStart: ({ active }) => `Seleccionaste ${active.data.current?.name}.`,
          onDragOver: ({ over }) => over ? `Destino: ${over.data.current?.status}.` : "Fuera de las columnas.",
          onDragEnd: ({ over }) => over ? `Soltaste en ${over.data.current?.status}.` : "Movimiento cancelado.",
          onDragCancel: () => "Movimiento cancelado. El estado se conserva." } }}>
      <div className={styles.board}>{order.map((status, index) => <Column key={status} status={status} visible={visible === status}
        rows={board.rows.filter((row) => row.status === status)} locked={locked} dragging={dragging} onEdit={onEdit}
        left={order[index - 1]} right={order[index + 1]} reorder={reorder} />)}</div>
    </DndContext>
  </section>;
}

function Column({ status, rows, visible, locked, dragging, onEdit, left, right, reorder }: { status: ClientStatus; rows: Client[]; visible: boolean; locked: boolean;
  dragging: boolean; onEdit: EditCard; left?: ClientStatus; right?: ClientStatus; reorder: (from: ClientStatus, to: ClientStatus) => void }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: columnId(status), data: { kind: "column", status }, disabled: locked });
  const { setNodeRef: setDragNodeRef, setActivatorNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: `reorder-${status}`, data: { kind: "column", status, name: `columna ${status}` }, disabled: locked });
  const setColumnRef = useCallback((node: HTMLElement | null) => { setNodeRef(node); setDragNodeRef(node); }, [setNodeRef, setDragNodeRef]);
  const [menu, setMenu] = useState(false), menuId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  const target = isOver && !locked && active?.data.current?.status !== status;
  return <section ref={setColumnRef} style={{ transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
    zIndex: isDragging ? 2 : undefined }} className={`${styles.column} ${visible ? styles.visibleColumn : ""} ${target ? styles.dropTarget : ""} ${isDragging ? styles.dragging : ""}`} data-column={status}>
    <header><div><h2>{status}</h2><span>{rows.length} {rows.length === 1 ? "cliente" : "clientes"}</span></div>
      <button type="button" className={`${styles.dragHandle} ${styles.columnHandle}`} ref={setActivatorNodeRef} {...attributes} {...listeners}
        disabled={locked} aria-label={`Arrastrar columna ${status}`}>⠿</button>
      <button type="button" className={styles.columnMenuButton} ref={menuButton} disabled={locked || dragging}
        aria-label={`Ordenar columna ${status}`} aria-expanded={menu} aria-controls={menuId} onClick={() => setMenu(!menu)}>⋯</button></header>
    {menu && <div id={menuId} className={styles.columnMenu} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setMenu(false); menuButton.current?.focus(); } }}>
      {[[left, "izquierda"], [right, "derecha"]].map(([to, direction]) => <button key={direction} type="button" disabled={!to || locked || dragging}
        onClick={() => { if (to) reorder(status, to as ClientStatus); setMenu(false); menuButton.current?.focus(); }}>Mover a la {direction}</button>)}
    </div>}
    {target && <p className={styles.dropCue}>{active?.data.current?.kind === "column" ? "Soltar columna aquí" : "Soltar aquí"}</p>}
    {rows.map((row) => <Card key={row.id} client={row} locked={locked || dragging} moveLocked={locked} onEdit={onEdit} />)}
  </section>;
}
function Card({ client, locked, moveLocked, onEdit }: { client: Client; locked: boolean; moveLocked: boolean; onEdit: EditCard }) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: `client-${client.id}`, data: { kind: "client", clientId: client.id, status: client.status, name: client.name }, disabled: moveLocked });
  const pointer = useRef<{ x: number; y: number } | null>(null), suppress = useRef(false);
  useLayoutEffect(() => { if (isDragging) suppress.current = true; }, [isDragging]);
  const open = (opener: HTMLElement) => { if (!locked && !suppress.current && window.getSelection()?.isCollapsed !== false) { opener.focus(); onEdit(client, opener); } };
  return <article ref={setNodeRef} className={`${styles.card} ${isDragging ? styles.dragging : ""}`} data-client={client.id}
    style={{
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, zIndex: isDragging ? 1 : undefined }}>
    <div role="button" tabIndex={locked ? -1 : 0} aria-label={`Abrir ${client.name}`} aria-disabled={locked} className={styles.cardContent}
      onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) open(event.currentTarget); }}
      onKeyDown={(event) => { if (event.target === event.currentTarget && ["Enter", " "].includes(event.key) && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        event.preventDefault(); suppress.current = false; open(event.currentTarget);
      } }} onPointerDown={(event) => {
        pointer.current = { x: event.clientX, y: event.clientY }; suppress.current = window.getSelection()?.isCollapsed === false;
        if (event.pointerType === "touch" || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || window.getSelection()?.isCollapsed === false) return;
        listeners?.onPointerDown?.(event);
      }} onPointerMove={(event) => { if (pointer.current && Math.hypot(event.clientX - pointer.current.x, event.clientY - pointer.current.y) >= 8) suppress.current = true; }}
      onPointerCancel={() => { suppress.current = true; pointer.current = null; }} onPointerUp={() => { pointer.current = null; }}>
    <h3>{client.name}</h3><p className={styles.cardCompany}>{client.company || "Sin empresa"}</p>
    <p>Rubro: {client.rubro || "Sin informar"}</p><p>Contacto: {date.format(new Date(client.contact_at))}</p>
    {client.meeting_at && <p>Cita: {date.format(new Date(client.meeting_at))}</p>}
    <p style={{ color: colors[STATUSES.indexOf(client.status)] }}>{client.status}</p>
    </div><button type="button" className={styles.dragHandle} data-drag-handle ref={setActivatorNodeRef} {...attributes} {...listeners} disabled={moveLocked}
        aria-describedby="move-instructions" aria-label={`Arrastrar cliente ${client.name}`}>⠿</button>
  </article>;
}
