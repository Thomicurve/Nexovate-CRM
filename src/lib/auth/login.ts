import { inspectAccess, type AuthClient } from "./access";

export type LoginState = {
  status: "idle" | "error" | "denied" | "success";
  message?: string;
  email?: string;
};

export const connectionMessage = "No pudimos conectar para comprobar el acceso. Intentá de nuevo.";

export async function performLogin(client: AuthClient, form: FormData): Promise<LoginState> {
  const emailValue = form.get("email");
  const password = form.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  if (!email || typeof password !== "string" || !password || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", email, message: "Ingresá un email válido y tu contraseña." };
  }
  try {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      return { status: "error", email, message: error.code === "invalid_credentials"
        ? "Email o contraseña incorrectos. Revisá los datos e intentá de nuevo."
        : connectionMessage };
    }
    const access = await inspectAccess(client);
    if (access.kind === "member") return { status: "success" };
    const logout = await client.auth.signOut({ scope: "local" });
    if (logout.error) return { status: "error", email, message: connectionMessage };
    return access.kind === "denied"
      ? { status: "denied", email, message: "Esta cuenta no tiene acceso al CRM." }
      : { status: "error", email, message: connectionMessage };
  } catch {
    return { status: "error", email, message: connectionMessage };
  }
}
