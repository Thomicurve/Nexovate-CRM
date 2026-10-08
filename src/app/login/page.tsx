import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inspectAccess } from "@/lib/auth/access";
import { connectionMessage } from "@/lib/auth/login";
import { LoginForm } from "@/components/auth/login-form";
import { login, logout } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ reason?: string }>;
}) {
  let kind = "unavailable";
  try { kind = (await inspectAccess(await createClient())).kind; } catch { /* Login stays reachable. */ }
  if (kind === "member") redirect("/dashboard");
  const { reason } = await searchParams;
  const denied = kind === "denied" || reason === "denied";
  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="login-title">
        <p className="brand">Nexovate</p>
        <div className="login-heading">
          <h1 id="login-title">Ingresar al CRM</h1>
          <p className="secondary">Seguimiento de clientes de ambos socios.</p>
        </div>
        {denied ? <>
          <p role="alert" className="auth-error">Esta cuenta no tiene acceso al CRM.</p>
          <p className="secondary">Ingresá con una de las dos cuentas autorizadas.</p>
          <form action={logout}><button type="submit" className="primary-button">Cerrar sesión</button></form>
        </> : <>
          {(kind === "unavailable" || reason === "unavailable") &&
            <p role="alert" className="auth-error">{connectionMessage}</p>}
          <LoginForm action={login} expired={reason === "expired"} />
        </>}
        <p className="login-footer secondary">Acceso privado para las dos cuentas autorizadas.</p>
      </section>
    </main>
  );
}
