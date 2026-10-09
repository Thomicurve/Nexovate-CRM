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
  const [open, setOpen] = useState(false);
  return <NotificationProvider><button onClick={() => setOpen(true)}>Editar</button>
    {open && <ClientModal client={confirmed} requestId="00000000-0000-4000-8000-000000000001" initialContact="" returnTo="/clientes"
      action={async () => ({ status: "idle" })} onClose={() => setOpen(false)} onDeleted={() => setOpen(false)}
      deleteAction={async (intent) => {
        window.deletionHarness.calls.push(intent.requestId);
        await new Promise<void>((resolve) => { window.deletionHarness.settle = resolve; });
        return window.deletionHarness.calls.length === 1 ? { kind: "error", retry: true, message: "Sin confirmar" } : { kind: "success" };
      }} />}
    <GlobalLoading /></NotificationProvider>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
