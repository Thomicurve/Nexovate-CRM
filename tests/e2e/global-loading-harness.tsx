import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { ClientModal } from "../../src/components/clients/client-modal";
import { GlobalLoading, RouteLoading, useLoadingOperation } from "../../src/components/ui/global-loading";
import { NotificationProvider } from "../../src/components/ui/notifications";
import { confirmed } from "../clients/fixture";
import "../../src/app/globals.css";

declare global { interface Window { loadingHarness: { settle: () => void; overlap: () => void; unmount: () => void } } }
function Harness() {
  const [modal, setModal] = useState(false), [route, setRoute] = useState(false);
  const run = useLoadingOperation();
  useEffect(() => {
    window.loadingHarness = { settle: () => {}, overlap: () => setRoute(true), unmount: () => { setRoute(false); setModal(false); } };
  }, []);
  return <NotificationProvider><button onClick={() => setModal(true)}>Editar</button>
    {route && <RouteLoading />}
    {modal && <ClientModal client={confirmed} requestId="00000000-0000-4000-8000-000000000001" initialContact="" returnTo="/clientes"
      onClose={() => setModal(false)} onSaved={() => { setRoute(true); setModal(false); }} action={async () => {
        await run(() => new Promise<void>((resolve) => { window.loadingHarness.settle = resolve; }));
        if (new URLSearchParams(window.location.search).has("success")) return { status: "success", client: confirmed };
        return { status: "error", message: "Error recuperable", retry: false };
      }} />}
    <GlobalLoading />
  </NotificationProvider>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
