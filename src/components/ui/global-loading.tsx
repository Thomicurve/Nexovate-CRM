"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import LatticeLoader from "./LatticeLoader";
import { usePanelMotion } from "./motion";
import styles from "./feedback.module.css";

const operations = { loading: "Cargando…", login: "Ingresando…", logout: "Cerrando sesión…", save: "Guardando cliente…",
  delete: "Eliminando cliente…", move: "Moviendo cliente…", clients: "Consultando clientes…", metrics: "Consultando métricas…", navigation: "Abriendo página…" };
export type LoadingOperation = keyof typeof operations;
const tokens = new Map<symbol, LoadingOperation>();
const listeners = new Set<() => void>();
let scrollLocks = 0, originalOverflow = "";
export function lockPageScroll() {
  if (scrollLocks++ === 0) { originalOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
  let released = false;
  return () => { if (!released) { released = true; if (--scrollLocks === 0) document.body.style.overflow = originalOverflow; } };
}
const publish = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useGlobalLoadingActive() {
  return useSyncExternalStore(subscribe, () => tokens.size > 0, () => false);
}
function begin(operation: LoadingOperation) {
  const token = Symbol(); tokens.set(token, operation); publish();
  return () => { if (tokens.delete(token)) publish(); };
}
export function usePendingLoading(active: boolean, operation: LoadingOperation = "loading") {
  useLayoutEffect(() => active ? begin(operation) : undefined, [active, operation]);
}
export function useLoadingOperation(operation: LoadingOperation = "loading") {
  const owned = useRef(new Set<() => void>());
  useEffect(() => { const operations = owned.current; return () => { operations.forEach((end) => end()); operations.clear(); }; }, []);
  return useCallback(async <T,>(work: () => Promise<T>): Promise<T> => {
    const end = begin(operation); owned.current.add(end);
    try { return await work(); }
    finally { end(); owned.current.delete(end); }
  }, [operation]);
}
export function FormLoading({ operation = "loading" }: { operation?: LoadingOperation }) { const { pending } = useFormStatus(); usePendingLoading(pending, operation); return null; }
export function RouteLoading({ operation = "navigation" }: { operation?: LoadingOperation }) { usePendingLoading(true, operation); return null; }

export function GlobalLoading() {
  const active = useSyncExternalStore(subscribe, () => [...new Set(tokens.values())].join(","), () => "");
  return active ? <LoadingDialog active={active} /> : null;
}
function LoadingDialog({ active }: { active: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null), [prolonged, setProlonged] = useState(false);
  usePanelMotion(panel, true);
  useEffect(() => { const timer = window.setTimeout(() => setProlonged(true), 8000); return () => window.clearTimeout(timer); }, []);
  const owners = active.split(",") as LoadingOperation[];
  const write = owners.some((operation) => ["save", "delete", "move"].includes(operation));
  useLayoutEffect(() => {
    const surface = dialog.current!, opener = document.activeElement as HTMLElement | null;
    let restore = opener;
    const releaseScroll = lockPageScroll();
    surface.showModal(); surface.focus();
    // A modal opened during an RSC commit must never become the interactive top layer.
    const observer = new MutationObserver((changes) => {
      if (changes.some((change) => change.target instanceof HTMLDialogElement && change.target !== surface && change.target.open)) {
        surface.close(); surface.showModal(); surface.focus();
      }
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
    const focus = (event: FocusEvent) => {
      if (!surface.contains(event.target as Node)) { restore = event.target as HTMLElement; surface.focus(); }
    };
    document.addEventListener("focusin", focus);
    return () => {
      observer.disconnect(); document.removeEventListener("focusin", focus);
      surface.close(); releaseScroll();
      if (restore?.isConnected && !restore.matches(":disabled")) restore.focus();
    };
  }, []);
  return <dialog ref={dialog} className="global-loading" aria-label="Cargando" aria-modal="true" tabIndex={-1}
    onCancel={(event) => event.preventDefault()} onKeyDown={(event) => { event.preventDefault(); event.stopPropagation(); }}>
    <div className={styles.panel} ref={panel} role="status" aria-live="polite" aria-atomic="true">
      <h2>{owners.map((operation) => operations[operation]).join(" · ")}</h2>
      <div aria-hidden="true"><LatticeLoader label="" color="#79aaff" cellSize={12} gap={5} shape="square" showTimer={false} elapsed={0} /></div>
      <p>{prolonged ? write ? "Todavía esperamos la respuesta. No vuelvas a enviar la operación hasta conocer el resultado."
        : "La carga está tardando. Esperá a que termine para continuar." : "Esperá un momento."}</p>
    </div>
  </dialog>;
}
