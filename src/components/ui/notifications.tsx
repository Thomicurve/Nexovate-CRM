"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./notifications.module.css";

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
  const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false);
  const remaining = useRef(6000);
  useEffect(() => {
    if (hovered || focused) return;
    const start = Date.now();
    const timer = window.setTimeout(dismiss, remaining.current);
    return () => { window.clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (Date.now() - start)); };
  }, [hovered, focused, dismiss]);
  return <div className={styles.toast} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
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
