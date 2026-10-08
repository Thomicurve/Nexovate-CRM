import { localToUtc, utcToLocal } from "./dates";
import { listPath, parseFilters, type SearchParams } from "./filters";

export const STATUSES = ["Contactado", "Reunión agendada", "Cerrado", "Sin respuesta", "Respuesta negativa", "Interesado"] as const;
export type ClientStatus = typeof STATUSES[number];
export type Client = { id: string; name: string; company: string | null; rubro: string | null; email: string | null;
  phone: string | null; notes: string | null; status: ClientStatus; contact_at: string; meeting_at: string | null;
  version: number; created_at: string; updated_at: string };
export type SaveState = { status: "idle" | "invalid" | "error" | "conflict" | "success";
  message?: string; errors?: Record<string, string>; retry?: boolean; confirmed?: Client; client?: Client };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type Payload = Record<string, string | null>;
export function isClient(value: unknown): value is Client {
  if (!value || typeof value !== "object") return false;
  const row = value as Client;
  return typeof row.id === "string" && UUID.test(row.id) && typeof row.name === "string" && Boolean(row.name.trim()) &&
    STATUSES.includes(row.status) && Number.isSafeInteger(row.version) && row.version > 0 &&
    [row.contact_at, row.created_at, row.updated_at].every((date) => typeof date === "string" && Boolean(utcToLocal(date))) &&
    [row.company, row.rubro, row.email, row.phone, row.notes].every((field) => field === null || typeof field === "string") &&
    (row.meeting_at === null || typeof row.meeting_at === "string" && Boolean(utcToLocal(row.meeting_at)));
}
const text = (form: FormData, name: string) => typeof form.get(name) === "string" ? String(form.get(name)).trim() : "";
export function normalizeForm(form: FormData) {
  const errors: Record<string, string> = {};
  const payload: Payload = {};
  for (const [field, limit] of Object.entries({ name: 200, company: 200, rubro: 120, email: 254, phone: 60, notes: 5000 })) {
    const value = text(form, field);
    payload[field] = value || null;
    if (value.length > limit) errors[field] = `Usá como máximo ${limit} caracteres.`;
  }
  if (!payload.name) errors.name = "Ingresá el nombre del cliente.";
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) errors.email = "Ingresá un email válido.";
  const clientId = text(form, "client_id"), requestId = text(form, "request_id");
  const mode = clientId ? "edit" as const : "create" as const;
  const versionText = text(form, "version"), version = Number(versionText);
  if (!UUID.test(requestId) || clientId && !UUID.test(clientId)) errors.form = "La solicitud no es válida. Recargá el formulario.";
  if (mode === "edit") {
    if (!/^\d+$/.test(versionText) || !Number.isSafeInteger(version) || version < 1) errors.form = "La versión no es válida. Recargá el cliente.";
    const status = text(form, "status");
    if (!STATUSES.includes(status as ClientStatus)) errors.status = "Elegí uno de los seis estados.";
    else payload.status = status;
  }
  for (const field of ["contact_at", "meeting_at"] as const) {
    const value = text(form, field), converted = localToUtc(value);
    if (field === "meeting_at" && !value) { payload[field] = null; continue; }
    const original = text(form, field === "contact_at" ? "original_contact" : "original_meeting");
    if (original && utcToLocal(original) === value) { payload[field] = original; continue; }
    if (!converted) { errors[field] = "Ingresá una fecha válida y sin ambigüedad en horario de Buenos Aires."; continue; }
    if (field === "contact_at" && mode === "create" && value === text(form, "initial_contact")) continue;
    payload[field] = converted;
  }
  return Object.keys(errors).length ? { ok: false as const, errors } :
    { ok: true as const, payload, clientId, requestId, version, mode };
}
export function safeReturnPath(value: string) {
  if (!/^\/clientes(?:\?|$)/.test(value) || value.includes("#") || value.includes("\\") || /[\r\n]/.test(value)) return "/clientes";
  const url = new URL(value, "https://local.invalid"), params: SearchParams = {};
  if (url.pathname !== "/clientes") return "/clientes";
  for (const [key, val] of url.searchParams) {
    if (!["nombre", "estado", "desde", "hasta", "pagina", "vista"].includes(key)) continue;
    const previous = params[key];
    params[key] = previous === undefined ? val : Array.isArray(previous) ? [...previous, val] : [previous, val];
  }
  const parsed = parseFilters(params);
  return parsed.ok ? listPath(parsed.filters) : "/clientes";
}
