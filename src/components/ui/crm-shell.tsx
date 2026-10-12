"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { useFormStatus } from "react-dom";
import { NavigationLinks } from "@/components/clients/navigation-links";
import { FormLoading } from "./global-loading";
import { Brand } from "./brand";
import { ChevronDown } from "./icons";
import { Button } from "./primitives";
import { usePanelMotion } from "./motion";

function LogoutButton({ trigger }: { trigger: RefObject<HTMLButtonElement | null> }) {
  const { pending } = useFormStatus(), wasPending = useRef(false);
  useEffect(() => {
    // Let the loading modal teardown remove the browser's inert background first.
    if (wasPending.current && !pending) queueMicrotask(() => trigger.current?.focus());
    wasPending.current = pending;
  }, [pending, trigger]);
  return <Button variant="ghost" type="submit" role="menuitem" disabled={pending}>Cerrar sesión</Button>;
}

export function CrmShell({ children, logout }: { children: ReactNode; logout: () => Promise<void> }) {
  const [open, setOpen] = useState(false), menuId = useId();
  const account = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null), main = useRef<HTMLElement>(null);
  usePanelMotion(menu, open);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function outside(event: PointerEvent) {
      if (!account.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    }
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="crm-shell">
    <a className="skip-link" href="#crm-content" onClick={() => main.current?.focus()}>Saltar al contenido</a>
    <header className="crm-header">
      <div className="crm-topbar">
        <Brand />
        <div className="account-control" ref={account} onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
        }}>
          <button className="ui-button account-trigger" ref={trigger} type="button" aria-haspopup="menu"
            aria-controls={open ? menuId : undefined} aria-expanded={open} onClick={() => setOpen(!open)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
            }}>Cuenta · Socio <ChevronDown /></button>
          <div className="account-menu" role="menu" aria-label="Cuenta" id={menuId} ref={menu} hidden={!open}
            onKeyDown={(event) => {
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault(); menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
              }
            }}>
            {/* Focus moves to GlobalLoading while pending; keep its form/token owner mounted. */}
            <form action={logout}><FormLoading operation="logout" /><LogoutButton trigger={trigger} /></form>
          </div>
        </div>
      </div>
      <nav className="crm-navigation" aria-label="Navegación principal"><NavigationLinks /></nav>
    </header>
    <main className="crm-content" id="crm-content" tabIndex={-1} ref={main}>{children}</main>
  </div>;
}
