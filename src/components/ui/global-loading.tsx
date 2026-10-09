"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import LatticeLoader from "./LatticeLoader";

const tokens = new Set<symbol>();
const listeners = new Set<() => void>();
let scrollLocks = 0, originalOverflow = "";
export function lockPageScroll() {
  if (scrollLocks++ === 0) { originalOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
  let released = false;
  return () => { if (!released) { released = true; if (--scrollLocks === 0) document.body.style.overflow = originalOverflow; } };
}
const publish = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function begin() {
  const token = Symbol(); tokens.add(token); publish();
  return () => { if (tokens.delete(token)) publish(); };
}
export function usePendingLoading(active: boolean) {
  useLayoutEffect(() => active ? begin() : undefined, [active]);
}
export function useLoadingOperation() {
  const owned = useRef(new Set<() => void>());
  useEffect(() => { const operations = owned.current; return () => { operations.forEach((end) => end()); operations.clear(); }; }, []);
  return useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    const end = begin(); owned.current.add(end);
    try { return await operation(); }
    finally { end(); owned.current.delete(end); }
  }, []);
}
export function FormLoading() { const { pending } = useFormStatus(); usePendingLoading(pending); return null; }
export function RouteLoading() { usePendingLoading(true); return null; }

export function GlobalLoading() {
  const active = useSyncExternalStore(subscribe, () => tokens.size > 0, () => false);
  return active ? <LoadingDialog /> : null;
}
function LoadingDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
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
    <div aria-label="Cargando, esperá un momento"><LatticeLoader label="Cargando" color="#a6caff" cellSize={12} gap={5} shape="square" showTimer={false} elapsed={0} /></div>
  </dialog>;
}
