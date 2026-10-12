"use client";

import type { LoginState } from "@/lib/auth/login";
import { useActionState, useState } from "react";
import { usePendingLoading } from "@/components/ui/global-loading";
import { Button, FormField } from "@/components/ui/primitives";

export type LoginAction = (state: LoginState, form: FormData) => Promise<LoginState>;

export function LoginForm({ action, expired = false }: { action: LoginAction; expired?: boolean }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const [showPassword, setShowPassword] = useState(false);
  usePendingLoading(pending, "login");
  return (
    <form action={formAction} className="login-form" aria-busy={pending}>
      <FormField id="email" label="Email">
        <input id="email" name="email" type="email" autoComplete="username" required
          maxLength={254} defaultValue={state.email} disabled={pending}
          aria-describedby={state.message ? "login-error" : undefined} />
      </FormField>
      <FormField id="password" label="Contraseña">
        <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password"
          required disabled={pending} aria-describedby={state.message ? "login-error" : undefined} />
      </FormField>
      <Button variant="secondary" className="password-toggle" aria-controls="password" aria-pressed={showPassword}
        disabled={pending} onClick={() => setShowPassword(!showPassword)}>
        {showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
      </Button>
      {state.message && <p id="login-error" className="auth-error" role="alert">{state.message}</p>}
      {state.status === "denied" && <p className="secondary">Ingresá con una de las dos cuentas autorizadas.</p>}
      <Button disabled={pending} type="submit">
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
      {expired && !pending && state.status === "idle" &&
        <p className="secondary" role="status">Tu sesión finalizó. Ingresá para continuar.</p>}
    </form>
  );
}
