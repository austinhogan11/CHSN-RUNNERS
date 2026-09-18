import { render, screen } from "@testing-library/react";
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
      title: "Easy Run",
      description: "Keep it relaxed",
      planned_distance: 5,
      start_time: null,
      duration_seconds: 2460,
      distance: 5.1,
      avg_pace_seconds: 482,
      status: "completed",
    },
    {
      id: "workout-2",
      date: "2026-09-15",
      title: "Workout",
      description: "6 x 800m at 10K effort",
      planned_distance: 7,
      start_time: null,
      duration_seconds: null,
      distance: null,
      avg_pace_seconds: null,
      status: "planned",
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});


describe("App", () => {
  it("shows loading state while workouts are being fetched", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    render(<App />);

    expect(
      screen.getByText("Loading workouts..."),
    ).toBeInTheDocument();
  });


  it("shows the current week and workouts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => weekResponse,
      }),
    );

    render(<App />);

    expect(
      await screen.findByText("This Week"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Easy Run"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Keep it relaxed"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Planned: 5.00 mi"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Actual: 5.10 mi"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Pace: 8:02 /mi"),
    ).toBeInTheDocument();
  });


  it("shows an error when workouts cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("API unavailable")),
    );

    render(<App />);

    expect(
      await screen.findByText(
        "Unable to load this week's workouts.",
      ),
    ).toBeInTheDocument();
  });
});