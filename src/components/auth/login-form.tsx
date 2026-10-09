"use client";

import type { LoginState } from "@/lib/auth/login";
import { useActionState } from "react";
import { usePendingLoading } from "@/components/ui/global-loading";

export type LoginAction = (state: LoginState, form: FormData) => Promise<LoginState>;

export function LoginForm({ action, expired = false }: { action: LoginAction; expired?: boolean }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  usePendingLoading(pending);
  return (
    <form action={formAction} className="login-form" aria-busy={pending}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required
          maxLength={254} defaultValue={state.email} disabled={pending}
          aria-describedby={state.message ? "login-error" : undefined} />
      </div>
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password"
          required disabled={pending} aria-describedby={state.message ? "login-error" : undefined} />
      </div>
      {state.message && <p id="login-error" className="auth-error" role="alert">{state.message}</p>}
      {state.status === "denied" && <p className="secondary">Ingresá con una de las dos cuentas autorizadas.</p>}
      <button className="primary-button" disabled={pending} type="submit">
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
      {expired && !pending && state.status === "idle" &&
        <p className="secondary" role="status">Tu sesión finalizó. Ingresá para continuar.</p>}
    </form>
  );
}
