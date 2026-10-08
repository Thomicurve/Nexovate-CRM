export const clientId = "11111111-1111-4111-8111-111111111111";
export const requestId = "22222222-2222-4222-8222-222222222222";
export const confirmed = { id: clientId, name: "Confirmado", company: null, email: null, phone: null,
  rubro: null, notes: null, contact_at: "2026-10-07T15:30:42.123Z", meeting_at: null,
  status: "Contactado" as const, version: 2, created_at: "2026-10-07T15:30:00Z", updated_at: "2026-10-07T15:31:00Z" };
export function form(overrides: Partial<Record<string, string>> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name: "  Cliente prueba  ", company: "", email: "", phone: "",
    rubro: "", notes: "", contact_at: "2026-10-07T12:30", meeting_at: "", initial_contact: "2026-10-07T12:30",
    request_id: requestId, client_id: "", version: "", return_to: "/clientes", ...overrides })) {
    if (value !== undefined) data.set(key, value);
  }
  return data;
}
