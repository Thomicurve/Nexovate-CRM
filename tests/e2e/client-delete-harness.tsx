import { createRoot } from "react-dom/client";
import { useState } from "react";
import { ClientModal } from "../../src/components/clients/client-modal";
import { GlobalLoading } from "../../src/components/ui/global-loading";
import { NotificationProvider } from "../../src/components/ui/notifications";
import { confirmed } from "../clients/fixture";
import "../../src/app/globals.css";
declare global { interface Window { deletionHarness: { calls: string[]; settle: () => void } } }
window.deletionHarness = { calls: [], settle() {} };
function Harness() {
  const params = new URLSearchParams(location.search), direct = params.get("direct") === "1", conflict = params.get("result") === "conflict";
  const [open, setOpen] = useState(direct);
  return <NotificationProvider><button onClick={() => setOpen(true)}>Editar</button>
    {open && <ClientModal client={confirmed} requestId="00000000-0000-4000-8000-000000000001" initialContact="" returnTo="/clientes?nombre=Confirmado&vista=tabla"
      action={async () => ({ status: "idle" })} onClose={direct ? undefined : () => setOpen(false)} onDeleted={() => setOpen(false)}
      deleteAction={async (intent) => {
        window.deletionHarness.calls.push(intent.requestId);
        await new Promise<void>((resolve) => { window.deletionHarness.settle = resolve; });
        if (conflict) return { kind: "conflict" };
        return window.deletionHarness.calls.length === 1 ? { kind: "error", retry: true, message: "Sin confirmar" } : { kind: "success" };
      }} />}
    <GlobalLoading /></NotificationProvider>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
