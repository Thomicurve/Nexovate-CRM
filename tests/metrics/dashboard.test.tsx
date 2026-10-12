import type { ReactNode } from "react";
import { WithLoading } from "../ui/loading-test-support";
import { act, render as renderUi, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/dashboard/dashboard";
import { METRIC_STATUSES, type Metric, type MetricsData } from "@/lib/metrics/model";
const f = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => f }));
vi.mock("@/components/dashboard/metric-chart", async (original) => ({ ...await original<typeof import("@/components/dashboard/metric-chart")>(),
  MetricChart: ({ metrics, buckets }: { metrics?: Metric[]; buckets?: Metric["buckets"] }) => <div data-testid="chart" data-periods={metrics?.[0].buckets.length ?? buckets?.length} /> }));
const query = { from: "2026-10-07", until: "2026-10-09", grouping: "day" as const };
function data(historical = 12, range = 3): MetricsData {
  return { kind: "ready", ...query, metrics: METRIC_STATUSES.map((status) => ({ status, historicalTotal: historical,
    rangeTotal: range, buckets: ["2026-10-07", "2026-10-08", "2026-10-09"].map((start, i) => ({ start, count: i === 1 ? range : 0 })) })) };
}
const render = (ui: ReactNode) => renderUi(ui, { wrapper: WithLoading });

beforeEach(() => vi.clearAllMocks());

describe("dashboard totals, range and accessible periods", () => {
  it("refreshes once and keeps confirmed metrics and range after a recoverable failure", async () => {
    let finish!: () => void;
    f.refresh.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const user = userEvent.setup(), result = data();
    const { rerender } = render(<Dashboard result={result} params={{}} />);
    await user.click(screen.getByRole("button", { name: "Actualizar" }));
    await user.click(screen.getByRole("button", { name: /Actualizando/ }));
    expect(f.refresh).toHaveBeenCalledOnce();
    rerender(<Dashboard result={{ kind: "unavailable", query }} params={{}} />);
    await act(async () => finish());
    expect(screen.getAllByText("12 históricos")).toHaveLength(3);
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos actualizar las métricas");
    expect(screen.getByLabelText("Desde")).toHaveValue(query.from);
    expect(screen.getByRole("button", { name: "Día" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Reintentar actualización" }));
    rerender(<Dashboard result={data(15, 4)} params={{}} />);
    expect(screen.getAllByText("15 históricos")).toHaveLength(3);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(f.push).not.toHaveBeenCalled();
  });
  it("keeps metrics and unlocks retry when refresh completes without new server props", async () => {
    let finish!: () => void;
    f.refresh.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<Dashboard result={data()} params={{}} />);
    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(screen.getByRole("status")).toHaveTextContent("Consultando métricas…");
    await act(async () => finish());
    expect(screen.getByRole("button", { name: "Actualizar" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos actualizar");
    expect(screen.getAllByText("12 históricos")).toHaveLength(3);
  });
  it("shows three distinct range/historical totals and every calendar period in semantic tables", async () => {
    render(<Dashboard result={data()} params={{}} />);
    for (const title of ["Contactados", "Reuniones", "Cerrados"]) {
      const metric = screen.getByRole("region", { name: title });
      expect(within(metric).getByLabelText(`${title} en el rango seleccionado`)).toHaveTextContent("3");
      expect(within(metric).getByText("12 históricos")).toBeVisible();
    }
    await userEvent.click(screen.getByText("Ver datos por período"));
    const table = screen.getByRole("table", { name: "Hitos por período" });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getByText("07/10/2026")).toBeVisible();
    expect(within(table).getAllByText("0")).toHaveLength(6);
    expect(screen.getAllByTestId("chart")).toHaveLength(1);
  });
  it("distinguishes no history from no activity in a range while preserving historical totals", () => {
    const view = render(<Dashboard result={data(0, 0)} params={{}} />);
    expect(screen.getByText("Todavía no hay actividad")).toBeVisible();
    expect(screen.getByRole("link", { name: "Nuevo cliente" })).toHaveAttribute("href", "/clientes/nuevo");
    view.rerender(<Dashboard result={data(12, 0)} params={{}} />);
    expect(screen.getByText("No hay nuevos hitos en estas fechas")).toBeVisible();
    expect(screen.getAllByText("12 históricos")).toHaveLength(3);
  });
  it("does not invent zero totals on provider failure and supports retry", async () => {
    render(<Dashboard result={{ kind: "unavailable", query }} params={{}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar las métricas");
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Contactados" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" })); expect(f.refresh).toHaveBeenCalledOnce();
  });
  it("preserves invalid entered bounds and explains corrections without querying or fake totals", () => {
    render(<Dashboard result={{ kind: "invalid", message: "Revisá el rango de fechas y la agrupación." }}
      params={{ desde: "2026-10-09", hasta: "2026-10-07" }} />);
    expect(screen.getByLabelText("Desde")).toHaveValue("2026-10-09");
    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-10-07");
    expect(screen.getByRole("alert")).toHaveTextContent("Revisá el rango");
    expect(screen.queryByText(/^Período aplicado:/)).toBeNull();
    expect(f.push).not.toHaveBeenCalled(); expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
  it("applies valid drafts explicitly with only allowed local URL parameters", async () => {
    render(<Dashboard result={data()} params={{}} />);
    await userEvent.clear(screen.getByLabelText("Desde")); await userEvent.type(screen.getByLabelText("Desde"), "2026-09-01");
    expect(f.push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Aplicar rango" }));
    expect(f.push).toHaveBeenCalledWith("/dashboard?desde=2026-09-01&hasta=2026-10-09&agrupacion=day");
  });
  it("rejects reversed draft dates locally and retains entered fields", async () => {
    render(<Dashboard result={data()} params={{}} />);
    await userEvent.clear(screen.getByLabelText("Hasta")); await userEvent.type(screen.getByLabelText("Hasta"), "2026-10-01");
    await userEvent.click(screen.getByRole("button", { name: "Aplicar rango" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Revisá el rango"); expect(f.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-10-01");
  });
  it.each([["Mes", "month"], ["Año", "year"], ["Día", "day"]])("group %s preserves draft dates and applies both explicitly", async (label, grouping) => {
    render(<Dashboard result={data()} params={{}} />);
    await userEvent.clear(screen.getByLabelText("Desde")); await userEvent.type(screen.getByLabelText("Desde"), "2026-09-01");
    await userEvent.click(screen.getByRole("button", { name: label }));
    expect(f.push).not.toHaveBeenCalled(); expect(screen.getByLabelText("Desde")).toHaveValue("2026-09-01");
    await userEvent.click(screen.getByRole("button", { name: "Aplicar rango" }));
    expect(f.push).toHaveBeenCalledWith(`/dashboard?desde=2026-09-01&hasta=2026-10-09&agrupacion=${grouping}`);
  });
  it("keeps confirmed totals and declares excessive series without empty placeholders", () => {
    render(<Dashboard result={{ kind: "too_many_buckets", from: "1900-01-01", until: "9999-12-31", grouping: "year", bucketCount: 8100,
      metrics: METRIC_STATUSES.map((status) => ({ status, historicalTotal: 42, rangeTotal: 20 })) }} params={{}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Reducí el rango");
    expect(screen.getAllByText("42 históricos")).toHaveLength(3); expect(screen.getAllByText("20")).toHaveLength(3);
    expect(screen.queryAllByTestId("chart")).toHaveLength(0); expect(screen.queryByText("No hay nuevos hitos en estas fechas")).not.toBeInTheDocument();
  });
  it("uses keyboard to apply and a native disclosure for the full accessible table", async () => {
    render(<Dashboard result={data()} params={{}} />);
    const button = screen.getByRole("button", { name: "Aplicar rango" }); button.focus(); await userEvent.keyboard("{Enter}");
    expect(f.push).toHaveBeenCalledOnce();
    const summary = screen.getAllByText("Ver datos por período")[0]; expect(summary.tagName).toBe("SUMMARY"); await userEvent.click(summary);
    expect(screen.getByRole("table", { name: "Hitos por período" })).toBeVisible();
  });
  it("preserves every period at the 2000-bucket limit in the chart input and table", async () => {
    const result = data(1, 0);
    if (result.kind !== "ready") throw new Error("Expected fixture series");
    const buckets = Array.from({ length: 2000 }, (_, i) => ({ start: new Date(Date.UTC(2020, 0, i + 1)).toISOString().slice(0, 10), count: 0 }));
    result.from = buckets[0].start; result.until = buckets[1999].start; result.metrics.forEach((metric) => { metric.buckets = buckets; });
    render(<Dashboard result={result} params={{}} />);
    for (const chart of screen.getAllByTestId("chart")) expect(chart).toHaveAttribute("data-periods", "2000");
    await userEvent.click(screen.getAllByText("Ver datos por período")[0]);
    expect(within(screen.getByRole("table", { name: "Hitos por período" })).getAllByRole("row")).toHaveLength(2001);
  });
});

it.each(["zero", "unknown", "real"])("explains comparison honestly with %s base", (base) => {
  const current = data();
  render(<Dashboard result={{ ...current, comparison: base === "unknown" ? { kind: "unavailable", query: { ...query, from: "2026-10-04", until: "2026-10-06" } } : {
    kind: "ready", query: { ...query, from: "2026-10-04", until: "2026-10-06" }, metrics: METRIC_STATUSES.map((status) => ({ status, historicalTotal: 12, rangeTotal: base === "zero" ? 0 : 2 })) } }} params={{}} />);
  expect(screen.getByText(/04\/10\/2026 a 06\/10\/2026/)).toBeVisible();
  const metric = screen.getByRole("region", { name: "Contactados" });
  expect(within(metric).getByText(base === "zero" ? /\+3 hitos.*base anterior: 0/i : base === "unknown" ? /Comparación no disponible/i : /\+1 hitos.*\+50 %/)).toBeVisible();
  if (base !== "real") expect(metric.textContent).not.toContain("%");
});
it("makes all three quick periods available without applying immediately", async () => {
  render(<Dashboard result={data()} params={{}} />);
  for (const label of ["Últimos siete días", "Mes actual", "Mes anterior"]) expect(screen.getByRole("button", { name: label })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Mes anterior" }));
  expect(f.push).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: /^Mes$/ }));
  const from = (screen.getByLabelText("Desde") as HTMLInputElement).value;
  await userEvent.click(screen.getByRole("button", { name: "Aplicar rango" }));
  expect(f.push).toHaveBeenCalledWith(expect.stringContaining(`desde=${from}`));
});

vi.mock("@/components/ui/motion", () => ({ usePanelMotion: vi.fn() }));
