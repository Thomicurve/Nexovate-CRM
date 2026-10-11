import type { ReactNode } from "react";
import { Brand } from "@/components/ui/brand";

export function LoginPanel({ children }: { children: ReactNode }) {
  return <main className="login-screen">
    <section className="login-panel" aria-labelledby="login-title">
      <Brand />
      <div className="login-heading">
        <h1 id="login-title">Tu cartera. Una sola vista.</h1>
        <p className="secondary">Seguimiento de clientes de ambos socios.</p>
      </div>
      {children}
      <p className="login-help secondary">Si tenés problemas para ingresar, contactá al administrador.</p>
      <p className="login-footer secondary">Acceso privado para las dos cuentas autorizadas.</p>
    </section>
  </main>;
}
