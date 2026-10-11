import { StrictMode, useRef } from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import gsap from "gsap";
import { usePanelMotion } from "@/components/ui/motion";

let reduced = false;
beforeEach(() => {
  reduced = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("no-preference") ? !reduced : reduced,
    media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
});
function Panel({ open = true }: { open?: boolean }) {
  const ref = useRef<HTMLDivElement>(null); usePanelMotion(ref, open);
  return <div ref={ref} data-testid="panel" style={{ opacity: 1 }}>Panel</div>;
}
it("scopes motion and reverts styles and tweens on close and StrictMode unmount", async () => {
  const outside = document.createElement("div"); document.body.append(outside);
  const initial = gsap.globalTimeline.getChildren().length;
  const view = render(<StrictMode><Panel /></StrictMode>), panel = view.getByTestId("panel");
  expect(gsap.getTweensOf(panel).length).toBe(1);
  expect(gsap.getTweensOf(outside)).toHaveLength(0);
  view.rerender(<StrictMode><Panel open={false} /></StrictMode>);
  expect(gsap.getTweensOf(panel)).toHaveLength(0);
  expect(panel.style.opacity).toBe("1"); expect(panel.style.transform).toBe("");
  view.rerender(<StrictMode><Panel /></StrictMode>); view.unmount();
  await waitFor(() => expect(gsap.globalTimeline.getChildren().length).toBe(initial));
  expect(panel.style.opacity).toBe("1"); outside.remove();
});
it("keeps content available immediately without motion when reduced motion is requested", () => {
  reduced = true;
  const view = render(<Panel />), panel = view.getByTestId("panel");
  expect(gsap.getTweensOf(panel)).toHaveLength(0);
  expect(panel.style.opacity).toBe("1"); expect(panel.style.transform).toBe("");
});
