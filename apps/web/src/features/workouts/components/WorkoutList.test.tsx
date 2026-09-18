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
  it("renders all seven days with real workout details and rest days", () => {
    render(<WorkoutList weekStart="2026-09-14" workouts={[workout]} />);

    expect(screen.getAllByRole("article")).toHaveLength(7);
    expect(screen.getAllByRole("article").map((row) => row.getAttribute("aria-label"))).toEqual([
      "Rest on 2026-09-14",
      "Rest on 2026-09-15",
      "Rest on 2026-09-16",
      "Rest on 2026-09-17",
      "Easy Run on 2026-09-18",
      "Rest on 2026-09-19",
      "Rest on 2026-09-20",
    ]);

    const row = within(screen.getByRole("article", { name: "Easy Run on 2026-09-18" }));
    expect(row.getByText("Skipped")).toBeInTheDocument();
    expect(row.getByText("Fri")).toBeInTheDocument();
    expect(row.getByText("Sep 18")).toBeInTheDocument();
    expect(row.getAllByText("—")).toHaveLength(2);
    expect(row.queryByText("0.00 mi")).not.toBeInTheDocument();

    const rest = within(screen.getByRole("article", { name: "Rest on 2026-09-14" }));
    expect(rest.getByText("Mon")).toBeInTheDocument();
    expect(rest.getByText("Sep 14")).toBeInTheDocument();
    expect(rest.getByRole("heading", { name: "Rest" })).toBeInTheDocument();
    expect(rest.queryByRole("definition")).not.toBeInTheDocument();
  });

  it("renders an entirely empty week as seven rest days", () => {
    render(<WorkoutList weekStart="2026-10-05" workouts={[]} />);

    expect(screen.getAllByRole("article")).toHaveLength(7);
    expect(screen.getAllByRole("heading", { name: "Rest" })).toHaveLength(7);
    expect(screen.getByRole("article", { name: "Rest on 2026-10-05" })).toHaveTextContent("Mon");
    expect(screen.getByRole("article", { name: "Rest on 2026-10-11" })).toHaveTextContent("Sun");
  });

  it("identifies today's workout using the local calendar date", () => {
    vi.stubEnv("TZ", "America/New_York");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-19T01:00:00Z"));
    render(<WorkoutList weekStart="2026-09-14" workouts={[{ ...workout, status: "planned" }]} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });
});
