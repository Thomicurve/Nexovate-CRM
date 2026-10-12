"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

type NavigationPosition = { currentEntry?: { index: number } | null };
export type ExitGuard = (leave: () => void) => void;

/** Protect the mounted draft before navigation consumers handle a traversal or link. */
export function useClientFormExit(dirty: boolean, blocked: boolean, requestExit: ExitGuard, navigate: (href: string) => void) {
  const latest = useRef({ dirty, blocked, requestExit, navigate });
  useLayoutEffect(() => { latest.current = { dirty, blocked, requestExit, navigate }; });
  useEffect(() => {
    const editorURL = location.href, editorState: unknown = history.state;
    const navigation = (window as Window & { navigation?: NavigationPosition }).navigation;
    const editorIndex = navigation?.currentEntry?.index;
    let restoring: number | null = null, leaving = false;
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!leaving && (latest.current.dirty || latest.current.blocked)) { event.preventDefault(); event.returnValue = ""; }
    }
    function click(event: MouseEvent) {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        anchor.hasAttribute("download") || anchor.target && anchor.target !== "_self" || anchor.hasAttribute("data-client-cancel")) return;
      const target = new URL(anchor.href, location.href);
      if (!/^https?:$/.test(target.protocol) || target.href === location.href ||
        target.origin === location.origin && target.pathname === location.pathname && target.search === location.search) return;
      if (!latest.current.dirty && !latest.current.blocked) return;
      event.preventDefault(); event.stopImmediatePropagation();
      latest.current.requestExit(() => { leaving = true; latest.current.navigate(target.origin === location.origin ? target.pathname + target.search + target.hash : target.href); });
    }
    function pop(event: PopStateEvent) {
      if (leaving) return;
      if (restoring !== null) {
        event.stopImmediatePropagation();
        const delta = restoring; restoring = null;
        latest.current.requestExit(() => { leaving = true; history.go(-delta); });
        return;
      }
      if (!latest.current.dirty && !latest.current.blocked) return;
      event.stopImmediatePropagation();
      const destinationIndex = navigation?.currentEntry?.index;
      if (editorIndex !== undefined && editorIndex >= 0 && destinationIndex !== undefined && destinationIndex >= 0 && editorIndex !== destinationIndex) {
        restoring = editorIndex - destinationIndex; history.go(restoring);
      } else {
        // Older browsers expose no traversal direction. Preserve the editor's exact
        // state and draft; replacing forward history is the conservative tradeoff.
        // Back/cancel repeats replace this same forward entry instead of accumulating.
        history.pushState(editorState, "", editorURL);
        latest.current.requestExit(() => { leaving = true; history.back(); });
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", pop, true);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("popstate", pop, true); document.removeEventListener("click", click, true); };
  }, []);
}

// A native loading dialog makes underlying controls inert. Focus after its actual
// removal, without waiting for animation or stealing focus during the operation.
export function focusAfterLoading(resolve: () => HTMLElement | null) {
  const observer = new MutationObserver(focus);
  function focus() {
    if (document.querySelector("dialog.global-loading[open]")) return;
    observer.disconnect(); resolve()?.focus();
  }
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
  focus();
  return () => observer.disconnect();
}
