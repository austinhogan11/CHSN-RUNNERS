import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const weekResponse = {
  week_start: "2026-09-14",
  planned_distance: 30,
  actual_distance: 5.1,
  workouts: [
    {
      id: "workout-1",
      date: "2026-09-14",
      type: "run",
      title: "Easy Run",
      description: "Keep it relaxed",
      planned_distance: 5,
      start_time: null,
      duration_seconds: 2460,
      distance: 5.1,
      status: "completed",
    },
    {
      id: "workout-2",
      date: "2026-09-15",
      type: "run",
      title: "Workout",
      description: "6 x 800m at 10K effort",
      planned_distance: 7,
      start_time: null,
      duration_seconds: null,
      distance: null,
      status: "planned",
    },
  ],
};

const trendResponse = [
  {
    week_start: "2026-09-07",
    planned_distance: 0,
    actual_distance: 0,
  },
  {
    week_start: "2026-09-14",
    planned_distance: 30,
    actual_distance: 5.1,
  },
];

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("App", () => {
  it("shows loading state while dashboard data is being fetched", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    render(<App />);

    expect(
      screen.getByText("Loading dashboard..."),
    ).toBeInTheDocument();
  });

  it("shows the mileage trend and current week", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => weekResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => trendResponse,
        }),
    );

    render(<App />);

    expect(
      await screen.findByText("Weekly Mileage Trend"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("This Week"),
    ).toBeInTheDocument();

    const run = within(screen.getByRole("article", { name: "Easy Run on 2026-09-14" }));
    for (const value of ["Easy Run", "Keep it relaxed", "Mon", "Sep 14", "5.00 mi", "5.10 mi", "8:02 /mi", "Completed"]) {
      expect(run.getByText(value)).toBeInTheDocument();
    }
    const plannedRun = within(screen.getByRole("article", { name: "Workout on 2026-09-15" }));
    expect(plannedRun.getAllByText("Planned")).toHaveLength(2);
    expect(plannedRun.getAllByText("—")).toHaveLength(2);
    expect(screen.getAllByRole("article")).toHaveLength(7);
    expect(screen.getAllByRole("heading", { name: "Rest" })).toHaveLength(5);

    const summary = within(screen.getByRole("region", { name: "This Week" }));
    expect(summary.getByText("30.00 mi")).toBeInTheDocument();
    expect(summary.getByText("5.10 mi")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Planned and actual weekly mileage/ })).toBeInTheDocument();
  });

  it("renders an empty week while keeping the mileage trend visible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            week_start: "2026-10-05",
            planned_distance: 0,
            actual_distance: 0,
            workouts: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => trendResponse,
        }),
    );

    render(<App />);

    expect(await screen.findAllByRole("heading", { name: "Rest" })).toHaveLength(7);
    expect(screen.getAllByRole("article")).toHaveLength(7);
    expect(
      screen.getByRole("heading", { name: "Weekly Mileage Trend" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Planned and actual weekly mileage/ })).toBeInTheDocument();
    fireEvent.click(screen.getByText("View weekly data"));
    expect(within(screen.getByRole("table")).getByText("30.00 mi")).toBeInTheDocument();

    const summary = screen.getByRole("region", { name: "This Week" });
    expect(within(summary).getAllByText("0.00 mi")).toHaveLength(2);
    expect(screen.queryByText("Easy Run")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Unable to load runner dashboard."),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["2026-09-21T03:59:59Z", "2026-09-20"],
    ["2026-09-21T04:00:00Z", "2026-09-21"],
  ])("requests both dashboard endpoints for the local day at %s", async (now, day) => {
    vi.stubEnv("TZ", "America/New_York");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => weekResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => trendResponse,
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "This Week" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/weeks/${day}`);
    expect(fetchMock).toHaveBeenCalledWith(`/api/trends/mileage?end=${day}&weeks=12`);
  });

  it("shows an error when dashboard data cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("API unavailable")),
    );

    render(<App />);

    expect(
      await screen.findByText(
        "Unable to load runner dashboard.",
      ),
    ).toBeInTheDocument();
  });
});
