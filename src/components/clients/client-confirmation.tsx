"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { lockPageScroll } from "@/components/ui/global-loading";
import { usePanelMotion } from "@/components/ui/motion";
import styles from "./clients.module.css";

export function ClientConfirmation({ title, children, confirmLabel, cancelLabel = "Seguir editando", onConfirm, onCancel }: {
  title: string; children: ReactNode; confirmLabel: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), titleId = useId(), descriptionId = useId();
  const accepted = useRef(false);
  usePanelMotion(dialog, true);
  useEffect(() => {
    const surface = dialog.current!, opener = document.activeElement as HTMLElement | null;
    const release = lockPageScroll();
    surface.showModal(); surface.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      surface.close(); release();
      if (!accepted.current) queueMicrotask(() => { if (opener?.isConnected) opener.focus(); });
    };
  }, []);
  return <dialog ref={dialog} className={styles.confirmation} aria-modal="true" aria-labelledby={titleId}
    aria-describedby={descriptionId} onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onCancel(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const buttons = dialog.current!.querySelectorAll<HTMLButtonElement>("button"), first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
    <h2 id={titleId}>{title}</h2><div id={descriptionId}>{children}</div>
    <div className={styles.actions}><button type="button" onClick={onCancel}>{cancelLabel}</button>
      <button type="button" className={styles.secondaryButton} onClick={() => { if (accepted.current) return; accepted.current = true; onConfirm(); }}>{confirmLabel}</button></div>
  </dialog>;
}
