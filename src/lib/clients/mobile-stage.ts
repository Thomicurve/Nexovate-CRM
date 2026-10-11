import { KANBAN_STATUSES, normalizeColumnOrder } from "./column-order";
import type { ClientStatus } from "./model";

const key = "crm:kanban-mobile-stage:v1";
type StorageAccess = Pick<Storage, "getItem" | "setItem">;
export function readMobileStage(order: readonly ClientStatus[], rows: readonly { status: ClientStatus }[], storage?: StorageAccess | null): ClientStatus {
  const stages = normalizeColumnOrder(order);
  const fallback = () => stages.find((status) => rows.some((row) => row.status === status)) ?? stages[0];
  try {
    const value: unknown = JSON.parse((storage === undefined ? window.localStorage : storage)?.getItem(key) ?? "null");
    return typeof value === "string" && KANBAN_STATUSES.includes(value as ClientStatus) ? value as ClientStatus : fallback();
  } catch { return fallback(); }
}
export function saveMobileStage(status: ClientStatus, storage?: StorageAccess | null) {
  if (!KANBAN_STATUSES.includes(status)) return;
  try { (storage === undefined ? window.localStorage : storage)?.setItem(key, JSON.stringify(status)); }
  catch { /* A blocked preference never prevents selecting a stage. */ }
}
