import type { ReactNode } from "react";
import { GlobalLoading } from "@/components/ui/global-loading";
window.matchMedia ??= (media) => ({ matches: media.includes(": reduce"), media, onchange: null,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true });
Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute("open", ""); this.focus(); } });
Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute("open"); } });
export function WithLoading({ children }: { children: ReactNode }) { return <>{children}<GlobalLoading /></>; }
