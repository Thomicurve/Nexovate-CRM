"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import styles from "./notifications.module.css";
import { usePanelMotion } from "./motion";
import { useGlobalLoadingActive } from "./global-loading";

type Notification = { id: number; title: string; detail: string };
const Notifications = createContext<(title: string, detail: string) => void>(() => {});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null);
  const sequence = useRef(0);
  const notify = useCallback((title: string, detail: string) => {
    setNotification({ id: ++sequence.current, title, detail });
  }, []);
  const dismiss = useCallback(() => setNotification(null), []);
  return <Notifications.Provider value={notify}>{children}
    {notification && <Toast key={notification.id} notification={notification} dismiss={dismiss} />}
  </Notifications.Provider>;
}

export const useNotification = () => useContext(Notifications);

function Toast({ notification, dismiss }: { notification: Notification; dismiss: () => void }) {
  const blocked = useGlobalLoadingActive(), remaining = useRef(6000);
  return blocked ? null : <AvailableToast notification={notification} dismiss={dismiss} remaining={remaining} />;
}

function AvailableToast({ notification, dismiss, remaining }: {
  notification: Notification; dismiss: () => void; remaining: RefObject<number>;
}) {
  const surface = useRef<HTMLDivElement>(null); usePanelMotion(surface, true);
  const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false);
  useEffect(() => {
    if (hovered || focused) return;
    const start = Date.now();
    const timer = window.setTimeout(dismiss, remaining.current);
    return () => { window.clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (Date.now() - start)); };
  }, [hovered, focused, dismiss, remaining]);
  return <div ref={surface} className={styles.toast} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
    }}>
    <span className={styles.icon} aria-hidden="true">✓</span>
    <div role="status" aria-live="polite" aria-atomic="true" className={styles.message}>
      <strong>{notification.title}</strong><p>{notification.detail}</p>
    </div>
    <button type="button" aria-label="Cerrar notificación" onClick={dismiss}>×</button>
  </div>;
}
