export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Accept publishable keys only, never privileged keys.
  if (!url || !key?.startsWith("sb_publishable_") || new URL(url).protocol !== "https:") {
    throw new Error("Falta configuración pública de Supabase válida");
  }
  return { url, key };
}
