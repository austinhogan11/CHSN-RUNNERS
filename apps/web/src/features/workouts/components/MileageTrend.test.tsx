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

function withLatest(previous: number, latest: number): MileageTrendPoint[] {
  return points.map((point, index) => ({
    ...point,
    actual_distance: index === 10 ? previous : index === 11 ? latest : 0,
  }));
}

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
  it("renders only the actual series without redundant trend chrome", () => {
    const { container } = renderTrend();
    const chart = screen.getByRole("group", { name: /Actual weekly mileage/ });
    const lines = chart.querySelectorAll("polyline");
    expect(lines).toHaveLength(1);
    expect(chart.querySelector("title")).not.toBeInTheDocument();
    const actual = coordinates(lines[0]);
    expect(actual).toHaveLength(12);
    expect(actual[11][1]).toBeLessThan(actual[0][1]);
    expect(actual[11][1]).toBeLessThan(220);
    expect(screen.queryByText("12 weeks · Jun 29–Sep 14, 2026 · miles")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Chart legend")).not.toBeInTheDocument();
    expect(container.querySelector(".legend-line")).not.toBeInTheDocument();
    expect(screen.queryByText("Week starting Monday")).not.toBeInTheDocument();
    expect(screen.queryByText("View weekly data")).not.toBeInTheDocument();
    expect(screen.queryByText("Planned")).not.toBeInTheDocument();
    expect(chart).toHaveTextContent("6/29");
    expect(chart).toHaveTextContent("9/14");
  });

  it("shows normal mileage feedback on pointer hover", () => {
    renderTrend();
    const point = screen.getByLabelText("Sep 14: 5.10 miles");
    expect(point).toHaveAttribute("tabindex", "0");

    fireEvent.mouseEnter(point);
    expect(screen.getByRole("tooltip", { name: "Sep 14, 5.10 mi" })).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Sep 145.10 mi");
    fireEvent.mouseLeave(point);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows zero-mile feedback on keyboard focus", () => {
    renderTrend();
    const point = screen.getByLabelText("Jun 29: 0.00 miles");

    fireEvent.focus(point);
    expect(screen.getByRole("tooltip", { name: "Jun 29, 0.00 mi" })).toBeInTheDocument();
    fireEvent.blur(point);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it.each([
    [8, 10, "+2.00 mi · +25%", "positive"],
    [9, 6, "−3.00 mi · −33%", "negative"],
    [0, 5.25, "+5.25 mi", "positive"],
    [0, 0, "No change", "neutral"],
    [5, 0, "−5.00 mi · −100%", "negative"],
  ])("compares previous %s miles with latest mileage %s", (previous, latest, expected, tone) => {
    renderTrend(withLatest(previous, latest));
    const comparison = screen.getByLabelText("Week-over-week mileage change");
    expect(comparison).toHaveTextContent(expected);
    expect(comparison).toHaveClass(tone);
    expect(comparison).not.toHaveTextContent(/Infinity|NaN|∞/);
  });

  it("recomputes comparison and point feedback when the trend window changes", () => {
    const view = renderTrend(withLatest(8, 10));
    expect(screen.getByLabelText("Week-over-week mileage change")).toHaveTextContent("+2.00 mi · +25%");

    view.rerender(
      <MileageTrend
        points={withLatest(9, 6)}
        isLoading={false}
        error={null}
        isLatestWindow={false}
        onPrevious={() => {}}
        onNext={() => {}}
      />,
    );

    expect(screen.getByLabelText("Week-over-week mileage change")).toHaveTextContent("−3.00 mi · −33%");
    expect(screen.getByLabelText("Sep 14: 6.00 miles")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next 12-week trend window" })).toBeEnabled();
  });

  it("keeps an all-zero history visible on a valid mileage scale", () => {
    renderTrend(points.map((point) => ({ ...point, planned_distance: 0, actual_distance: 0 })));
    const chart = screen.getByRole("group", { name: /Actual weekly mileage/ });
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
    expect(screen.queryByRole("group", { name: /Actual weekly mileage/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Week-over-week mileage change")).not.toBeInTheDocument();
  });

  it("retains all mileage points and the current week when date labels thin on mobile", () => {
    vi.stubGlobal("ResizeObserver", vi.fn(function(callback: (entries: { contentRect: { width: number } }[]) => void) {
      return {
        observe: () => callback([{ contentRect: { width: 320 } }]),
        disconnect: vi.fn(),
      };
    }));

    renderTrend();

    const chart = screen.getByRole("group", { name: /Actual weekly mileage/ });
    expect(coordinates(chart.querySelector("polyline")!)).toHaveLength(12);
    expect(within(chart).getByText("6/29")).toBeInTheDocument();
    expect(within(chart).getByText("9/14")).toBeInTheDocument();
    expect(within(chart).queryByText("7/6")).not.toBeInTheDocument();
  });
});
