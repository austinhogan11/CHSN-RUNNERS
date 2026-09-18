import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkoutList } from "./WorkoutList";
import type { Workout } from "../types";

const workout: Workout = {
  id: "run-1", date: "2026-09-18", title: "Easy Run", description: null,
  planned_distance: 5, start_time: null, duration_seconds: null,
  distance: null, avg_pace_seconds: null, status: "skipped",
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("WorkoutList", () => {
  it("shows skipped status and missing execution metrics without inventing zeroes", () => {
    render(<WorkoutList workouts={[workout]} />);
    const row = within(screen.getByRole("article", { name: "Easy Run on 2026-09-18" }));
    expect(row.getByText("Skipped")).toBeInTheDocument();
    expect(row.getByText("Fri")).toBeInTheDocument();
    expect(row.getByText("Sep 18")).toBeInTheDocument();
    expect(row.getAllByText("—")).toHaveLength(2);
    expect(row.queryByText("0.00 mi")).not.toBeInTheDocument();
  });

  it("identifies today's workout using the local calendar date", () => {
    vi.stubEnv("TZ", "America/New_York");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-19T01:00:00Z"));
    render(<WorkoutList workouts={[{ ...workout, status: "planned" }]} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });
});
