import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MileageTrend } from "./MileageTrend";
import type { MileageTrendPoint } from "../types";

const points: MileageTrendPoint[] = Array.from({ length: 12 }, (_, index) => {
  const week = new Date(Date.UTC(2026, 5, 29 + index * 7));
  return {
    week_start: week.toISOString().slice(0, 10),
    planned_distance: index === 11 ? 30 : 0,
    actual_distance: index === 11 ? 5.1 : 0,
  };
});

function renderTrend(trendPoints: MileageTrendPoint[] = points) {
  return render(
    <MileageTrend
      points={trendPoints}
      isLoading={false}
      error={null}
      isLatestWindow
      onPrevious={() => {}}
      onNext={() => {}}
    />,
  );
}

function coordinates(line: Element) {
  return line.getAttribute("points")!.trim().split(/\s+/).map((point) => point.split(",").map(Number));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MileageTrend", () => {
  it("plots actual mileage chronologically and ignores planned mileage when scaling", () => {
    renderTrend();
    const chart = screen.getByRole("img", { name: /Actual weekly mileage/ });
    const lines = chart.querySelectorAll("polyline");
    expect(lines).toHaveLength(1);
    const actual = coordinates(lines[0]);
    expect(actual).toHaveLength(12);
    for (let index = 0; index < 11; index++) {
      expect(actual[index][1]).toBe(actual[0][1]);
      expect(actual[index + 1][0]).toBeGreaterThan(actual[index][0]);
    }
    expect(actual[11][1]).toBeLessThan(actual[0][1]);
    expect(actual[11][1]).toBeLessThan(220);
    expect(screen.getByLabelText("Chart legend")).toHaveTextContent("Actual");
    expect(screen.queryByText("Planned")).not.toBeInTheDocument();
    expect(chart.querySelector(".planned")).not.toBeInTheDocument();
    expect(chart).toHaveTextContent("6/29");
    expect(chart).toHaveTextContent("9/14");
  });

  it("provides exact accessible data for all 12 weeks, including empty weeks", () => {
    renderTrend();
    fireEvent.click(screen.getByText("View weekly data"));
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(13);
    expect(rows[1]).toHaveTextContent("2026-06-29");
    expect(within(rows[1]).getByText("0.00 mi")).toBeInTheDocument();
    expect(rows[12]).toHaveTextContent("2026-09-14");
    expect(rows[12]).toHaveTextContent("5.10 mi");
    expect(screen.queryByRole("columnheader", { name: "Planned" })).not.toBeInTheDocument();
  });

  it("keeps an all-zero history visible on a valid mileage scale", () => {
    renderTrend(points.map((point) => ({ ...point, planned_distance: 0, actual_distance: 0 })));
    const chart = screen.getByRole("img", { name: /Actual weekly mileage/ });
    for (const line of chart.querySelectorAll("polyline")) {
      const plotted = coordinates(line);
      expect(plotted).toHaveLength(12);
      expect(plotted.flat().every(Number.isFinite)).toBe(true);
      expect(new Set(plotted.map(([, y]) => y)).size).toBe(1);
    }
  });

  it("shows an intentional state when no history was returned", () => {
    renderTrend([]);
    expect(screen.getByText("No mileage history yet.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("retains all mileage points and the current week when date labels thin on mobile", () => {
    vi.stubGlobal("ResizeObserver", vi.fn(function(callback: (entries: { contentRect: { width: number } }[]) => void) {
      return {
        observe: () => callback([{ contentRect: { width: 320 } }]),
        disconnect: vi.fn(),
      };
    }));

    renderTrend();

    const chart = screen.getByRole("img", { name: /Actual weekly mileage/ });
    for (const line of chart.querySelectorAll("polyline")) {
      expect(coordinates(line)).toHaveLength(12);
    }
    expect(within(chart).getByText("6/29")).toBeInTheDocument();
    expect(within(chart).getByText("9/14")).toBeInTheDocument();
    expect(within(chart).queryByText("7/6")).not.toBeInTheDocument();
  });
});
