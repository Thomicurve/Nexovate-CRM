"use client";

import type { RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// Animate only this panel; React/GSAP revert interruptions and navigation locally.
export function usePanelMotion(scope: RefObject<HTMLElement | null>, open: boolean) {
  useGSAP(() => {
    if (!open || !scope.current) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(scope.current, { opacity: 0, y: -6 }, {
        opacity: 1, y: 0, duration: 0.2, ease: "power2.out", clearProps: "opacity,transform",
      });
    });
    return () => media.revert();
  }, { scope, dependencies: [open], revertOnUpdate: true });
}
