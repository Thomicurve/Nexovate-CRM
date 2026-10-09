import { type ClientStatus } from "./model";

// Presentation preference only; domain filters and metrics keep their own ordering.
export const KANBAN_STATUSES: readonly ClientStatus[] = ["Contactado", "Interesado", "Reunión agendada", "Cerrado", "Sin respuesta", "Respuesta negativa"];
const key = "crm:kanban-column-order:v1";
type StorageAccess = Pick<Storage, "getItem" | "setItem">;
export function normalizeColumnOrder(value: unknown): ClientStatus[] {
  const known = Array.isArray(value) ? value.filter((status): status is ClientStatus => KANBAN_STATUSES.includes(status)) : [];
  return [...new Set([...known, ...KANBAN_STATUSES])];
}
export function readColumnOrder(storage?: StorageAccess | null): ClientStatus[] {
  try { return normalizeColumnOrder(JSON.parse((storage === undefined ? window.localStorage : storage)?.getItem(key) ?? "null")); }
  catch { return [...KANBAN_STATUSES]; }
}
export function saveColumnOrder(order: readonly ClientStatus[], storage?: StorageAccess | null) {
  try { (storage === undefined ? window.localStorage : storage)?.setItem(key, JSON.stringify(normalizeColumnOrder(order))); }
  catch { /* A blocked preference never prevents using the board. */ }
}
export function reorderColumn(order: readonly ClientStatus[], from: ClientStatus, to: ClientStatus): ClientStatus[] {
  const next = normalizeColumnOrder(order), start = next.indexOf(from), end = next.indexOf(to);
  next.splice(start, 1); next.splice(end, 0, from); return next;
}
