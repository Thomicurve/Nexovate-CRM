import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LoginForm } from "../../src/components/auth/login-form";
import { LoginPanel } from "../../src/components/auth/login-panel";
import { CrmShell } from "../../src/components/ui/crm-shell";
import { GlobalLoading } from "../../src/components/ui/global-loading";
import "@fontsource/geist/latin-400.css";
import "@fontsource/geist/latin-500.css";
import "@fontsource/geist/latin-600.css";
import "../../src/app/globals.css";

const root = createRoot(document.getElementById("root")!);
let finishLogout: (() => void) | undefined;
let logoutCalls = 0;
Object.assign(window, { shellHarness: { finishLogout: () => finishLogout?.(), logoutCalls: () => logoutCalls } });
root.render(<StrictMode>{window.location.pathname === "/login" ?
  <LoginPanel><LoginForm action={async () => ({ status: "error", message: "Error simulado. Revisá los datos." })} /></LoginPanel> :
  <CrmShell logout={async () => { logoutCalls++; await new Promise<void>((resolve) => { finishLogout = resolve; }); }}>
    <h1>Clientes</h1><p className="secondary">Cartera de prueba aislada.</p><button onClick={() => root.unmount()}>Salir del harness</button>
  </CrmShell>}<GlobalLoading /></StrictMode>);
