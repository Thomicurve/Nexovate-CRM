import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inspectAccess } from "@/lib/auth/access";
import { connectionMessage } from "@/lib/auth/login";
import { LoginForm } from "@/components/auth/login-form";
import { LoginPanel } from "@/components/auth/login-panel";
import { FormLoading } from "@/components/ui/global-loading";
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
    <LoginPanel>
        {denied ? <>
          <p role="alert" className="auth-error">Esta cuenta no tiene acceso al CRM.</p>
          <p className="secondary">Ingresá con una de las dos cuentas autorizadas.</p>
          <form action={logout}><FormLoading operation="logout" /><button type="submit" className="primary-button">Cerrar sesión</button></form>
        </> : <>
          {(kind === "unavailable" || reason === "unavailable") &&
            <p role="alert" className="auth-error">{connectionMessage}</p>}
          <LoginForm action={login} expired={reason === "expired"} />
        </>}
    </LoginPanel>
  );
}
