import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StrengthApiError } from "../api";
import type { ExerciseBlock, PlannedSet, StrengthSession, StrengthWeek } from "../types";
import { StrengthWeekDashboard } from "./StrengthWeekDashboard";

const exercises = [
  {
    id: "bench_press",
    name: "Bench Press",
    category: "barbell",
    default_max_source: "bench_press",
    is_custom: false,
  },
  {
    id: "farmers_walk",
    name: "Farmers Walk",
    category: "carry",
    default_max_source: null,
    is_custom: false,
  },
  {
    id: "timed_hold",
    name: "Timed Hold",
    category: "carry",
    default_max_source: null,
    is_custom: true,
  },
  {
    id: "chin_up",
    name: "Chin-Up",
    category: "bodyweight",
    default_max_source: null,
    is_custom: false,
  },
  {
    id: "conditioning_run",
    name: "Conditioning Run",
    category: "conditioning",
    default_max_source: null,
    is_custom: false,
  },
];

const upperSession: StrengthSession = {
  id: "session-1",
  date: "2026-09-23",
  title: "Upper Body",
  notes: "Controlled reps",
  exercise_blocks: [
    {
      id: "block-1",
      exercise_id: "bench_press",
      order: 1,
      group_id: null,
      label: null,
      planned_sets: [
        {
          id: "set-1",
          set_number: 1,
          target_reps: 5,
          target_distance: null,
          distance_unit: null,
          target_duration_seconds: null,
          percentage: null,
          max_source: null,
          max_value_at_creation: null,
          target_weight: 135,
          rest_seconds: 90,
        },
      ],
      actual_sets: [],
    },
  ],
};

const week: StrengthWeek = {
  week_start: "2026-09-21",
  week_end: "2026-09-27",
  sessions: [
    upperSession,
    {
      ...upperSession,
      id: "session-2",
      title: "Evening Accessories",
      exercise_blocks: [],
    },
  ],
};

const programs = [
  {
    id: "ppsa-sport-strength",
    name: "PPSA Sport Strength",
    days: [
      { id: "ppsa-day-1", day_number: 1, name: "Day 1", exercise_blocks: [] },
      { id: "ppsa-day-2", day_number: 2, name: "Day 2", exercise_blocks: [] },
    ],
  },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-23T12:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("StrengthWeekDashboard", () => {
  it("renders Monday through Sunday, today, and a concise empty selected day", () => {
    renderDashboard({ week: { ...week, sessions: [] } });

    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByRole("button", { name: /Select Wednesday, Sep 23, today/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getAllByText("Today")).toHaveLength(2);
    expect(screen.getByText("No strength sessions for this day.")).toBeInTheDocument();
  });

  it("shows multiple sessions on the selected day as distinct choices", () => {
    renderDashboard();
    const sessions = within(screen.getByLabelText("Strength sessions"));

    expect(sessions.getByRole("button", { name: /Upper Body/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(sessions.getByRole("button", { name: /Evening Accessories/ }));
    expect(sessions.getByRole("button", { name: /Evening Accessories/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Edit title: Evening Accessories" })).toBeInTheDocument();
  });

  it("creates a default session on the selected date without a title or notes form", async () => {
    const onCreate = vi
      .fn()
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce({ ...upperSession, id: "new-session", date: "2026-09-24" });
    renderDashboard({ onCreate });

    fireEvent.click(screen.getByRole("button", { name: /Select Thursday, Sep 24/ }));
    expect(screen.queryByRole("textbox", { name: "Session title" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ Blank workout" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to create strength session",
    );

    fireEvent.click(screen.getByRole("button", { name: "+ Blank workout" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(2));
    expect(onCreate).toHaveBeenLastCalledWith({
      date: "2026-09-24",
      title: "Strength Session",
      notes: null,
      exercise_blocks: [],
    });
    expect(screen.getByRole("region", { name: /Thursday, Sep 24, 2026/ })).toHaveFocus();
  });

  it("uses frequency defaults, validates custom weekdays, and schedules the whole plan", async () => {
    const onScheduleProgram = vi.fn().mockResolvedValue({ instance: {}, sessions: [] });
    renderDashboard({ onScheduleProgram });

    expect(screen.getByRole("button", { name: "Mon" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Wed" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Fri" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    expect(screen.getByRole("button", { name: "Tue" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Thu" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Tue" }));
    fireEvent.click(screen.getByRole("button", { name: "Add plan to calendar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose exactly 4 training days");
    fireEvent.click(screen.getByRole("button", { name: "Sat" }));
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-09-30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add plan to calendar" }));

    await waitFor(() => expect(onScheduleProgram).toHaveBeenCalledWith(
      "ppsa-sport-strength",
      {
        start_date: "2026-09-30",
        days_per_week: 4,
        selected_weekdays: [0, 3, 4, 5],
        allow_duplicate: false,
      },
    ));
  });

  it.each([
    [2, ["Mon", "Thu"]],
    [3, ["Mon", "Wed", "Fri"]],
    [4, ["Mon", "Tue", "Thu", "Fri"]],
    [5, ["Mon", "Tue", "Wed", "Thu", "Fri"]],
    [6, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]],
    [7, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]],
  ])("defaults %i training days to %s", (frequency, selected) => {
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: String(frequency) }));

    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      expect(screen.getByRole("button", { name: day })).toHaveAttribute(
        "aria-pressed",
        String(selected.includes(day)),
      );
    }
  });

  it("warns before scheduling a second instance and permits explicit confirmation", async () => {
    const onScheduleProgram = vi.fn()
      .mockRejectedValueOnce(new StrengthApiError("conflict", 409, "This training plan is already scheduled."))
      .mockResolvedValueOnce({ instance: {}, sessions: [] });
    renderDashboard({ onScheduleProgram });

    fireEvent.click(screen.getByRole("button", { name: "Add plan to calendar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already scheduled");
    fireEvent.click(screen.getByRole("button", { name: "Schedule another run" }));

    await waitFor(() => expect(onScheduleProgram).toHaveBeenLastCalledWith(
      "ppsa-sport-strength",
      expect.objectContaining({ allow_duplicate: true }),
    ));
  });

  it("moves a persisted workout with a date-only patch", async () => {
    const onUpdate = vi.fn().mockResolvedValue({ ...upperSession, date: "2026-09-30" });
    renderDashboard({ onUpdate });

    const title = screen.getByRole("button", { name: `Edit title: ${upperSession.title}` });
    const sessionHeading = title.closest<HTMLElement>(".strength-session-heading")!;
    const moveButton = within(sessionHeading).getByRole("button", { name: "Move" });
    fireEvent.click(moveButton);
    fireEvent.change(screen.getByLabelText("Move workout date"), {
      target: { value: "2026-09-30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save move" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(
      "session-1",
      { date: "2026-09-30" },
    ));
  });

  it("edits the title inline and keeps notes hidden until requested", async () => {
    const saved = { ...upperSession, title: "Upper Strength" };
    const onUpdate = vi.fn().mockResolvedValue(saved);
    renderDashboard({ onUpdate });

    expect(screen.queryByRole("textbox", { name: "Session notes" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit notes" }));
    expect(screen.getByRole("textbox", { name: "Session notes" })).toHaveValue("Controlled reps");

    fireEvent.click(screen.getByRole("button", { name: "Edit title: Upper Body" }));
    const title = screen.getByRole("textbox", { name: "Session title" });
    fireEvent.change(title, { target: { value: "Discard me" } });
    fireEvent.keyDown(title, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Edit title: Upper Body" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit title: Upper Body" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Session title" }), {
      target: { value: "Upper Strength" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Session title" }), { key: "Enter" });

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({ title: "Upper Strength" }),
    );
    expect(screen.getByRole("button", { name: "Edit title: Upper Strength" })).toBeInTheDocument();
  });

  it("shows only the normal fields for a fixed-weight exercise and validates reps", async () => {
    const saved = { ...upperSession };
    const onUpdate = vi.fn().mockResolvedValue(saved);
    renderDashboard({ onUpdate });
    openExerciseEditor("Bench Press");

    expect(screen.getByRole("combobox", { name: "Bench Press prescription" })).toHaveValue("fixed");
    expect(screen.getByRole("spinbutton", { name: "Bench Press set 1 reps" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Bench Press set 1 weight" })).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "Bench Press set 1 percentage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "Bench Press set 1 distance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "Bench Press set 1 duration seconds" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("spinbutton", { name: "Bench Press set 1 reps" }), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("reps must be a whole number greater than 0");
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("spinbutton", { name: "Bench Press set 1 reps" }), {
      target: { value: "6" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Bench Press set 1 weight" }), {
      target: { value: "145" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate).toHaveBeenCalledWith("session-1", {
      title: "Upper Body",
      notes: "Controlled reps",
      exercise_blocks: [
        expect.objectContaining({
          id: "block-1",
          order: 1,
          planned_sets: [
            expect.objectContaining({
              id: "set-1",
              set_number: 1,
              target_reps: 6,
              target_weight: 145,
              percentage: null,
              max_source: null,
            }),
          ],
          actual_sets: [],
        }),
      ],
    });
  });

  it("uses progressive fields for percentage, reps, distance, and duration prescriptions", () => {
    const modeSession = sessionWithBlocks([
      block("percentage", "bench_press", [
        plannedSet("percentage-1", 1, { target_reps: 5, percentage: 55, max_source: "bench_press", target_weight: 145 }),
      ]),
      block("reps", "chin_up", [plannedSet("reps-1", 1, { target_reps: 5 })]),
      block("distance", "farmers_walk", [plannedSet("distance-1", 1, { target_distance: 20, distance_unit: "yards", target_weight: 80 })]),
      block("duration", "timed_hold", [plannedSet("duration-1", 1, { target_duration_seconds: 30, target_weight: 80 })]),
    ]);
    renderDashboard({ week: { ...week, sessions: [modeSession] } });
    for (const name of ["Bench Press", "Chin-Up", "Farmers Walk", "Timed Hold"]) {
      openExerciseEditor(name);
    }

    const percentage = within(screen.getByRole("region", { name: "Bench Press" }));
    expect(percentage.getByRole("spinbutton", { name: "Bench Press set 1 reps" })).toBeInTheDocument();
    expect(percentage.getByRole("spinbutton", { name: /percentage/ })).toBeInTheDocument();
    expect(percentage.getByRole("combobox", { name: "Bench Press max source" })).toHaveValue("bench_press");
    expect(percentage.queryByRole("spinbutton", { name: "Bench Press set 1 weight" })).not.toBeInTheDocument();

    const reps = within(screen.getByRole("region", { name: "Chin-Up" }));
    expect(reps.getAllByRole("spinbutton")).toHaveLength(2);
    expect(reps.getByRole("spinbutton", { name: "Chin-Up set 1 reps" })).toBeInTheDocument();
    expect(reps.getByRole("spinbutton", { name: "Chin-Up set 1 actual reps" })).toBeInTheDocument();

    const distance = within(screen.getByRole("region", { name: "Farmers Walk" }));
    expect(distance.getByRole("spinbutton", { name: "Farmers Walk set 1 distance" })).toBeInTheDocument();
    expect(distance.getByRole("combobox", { name: /distance unit/ })).toBeInTheDocument();
    expect(distance.getByRole("spinbutton", { name: "Farmers Walk set 1 weight" })).toBeInTheDocument();
    expect(distance.queryByRole("spinbutton", { name: "Farmers Walk set 1 reps" })).not.toBeInTheDocument();

    const duration = within(screen.getByRole("region", { name: "Timed Hold" }));
    expect(duration.getByRole("spinbutton", { name: "Timed Hold set 1 duration seconds" })).toBeInTheDocument();
    expect(duration.getByRole("spinbutton", { name: "Timed Hold set 1 weight" })).toBeInTheDocument();
    expect(duration.queryByRole("spinbutton", { name: "Timed Hold set 1 distance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(percentage.getByRole("spinbutton", { name: "Bench Press set 1 actual reps" }).closest("[data-layout]"))
      .toHaveAttribute("data-layout", "stacked-set");
  });

  it("renders percentage, fixed-weight, and reps-only sets as compact execution cells", () => {
    const compactSession = sessionWithBlocks([
      block("percentage", "bench_press", [
        plannedSet("percentage-1", 1, {
          target_reps: 5,
          percentage: 65,
          max_source: "bench_press",
          target_weight: 145,
        }),
      ]),
      block("fixed", "farmers_walk", [
        plannedSet("fixed-1", 1, { target_reps: 5, target_weight: 185 }),
      ]),
      block("reps", "chin_up", [plannedSet("reps-1", 1, { target_reps: 4 })]),
    ]);
    renderDashboard({ week: { ...week, sessions: [compactSession] } });

    expect(screen.getByText("5 reps · 65% · 145 lb planned")).toBeInTheDocument();
    expect(screen.getByText("185 lb × 5")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Chin-Up sets" })).getByText("4 reps"))
      .toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Bench Press set 1 actual weight" })).toHaveValue(145);
    expect(screen.getByRole("spinbutton", { name: "Chin-Up set 1 actual reps" })).toHaveValue(4);
    expect(screen.queryByRole("combobox", { name: /prescription/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Bench Press" })).toHaveAttribute(
      "data-layout",
      "compact-exercise",
    );
  });

  it("represents grouped exercises as compact A/B supersets", () => {
    const supersetSession = sessionWithBlocks([
      { ...block("a", "bench_press", [plannedSet("a-1", 1, { target_reps: 5 })]), group_id: "ss-1", label: "A1" },
      { ...block("b", "chin_up", [plannedSet("b-1", 1, { target_reps: 5 })]), group_id: "ss-1", label: "A2" },
    ]);
    renderDashboard({ week: { ...week, sessions: [supersetSession] } });

    expect(within(screen.getByRole("region", { name: "Bench Press" })).getByText("1A.")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Chin-Up" })).getByText("1B.")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Bench Press" })).getByText("SS")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Bench Press" })).toHaveClass("is-superset");
  });

  it("uses planned defaults for one-tap completion and preserves an actual deviation", async () => {
    const onUpdate = vi.fn().mockImplementation(async (_id, payload) => ({
      ...upperSession,
      ...payload,
    }));
    renderDashboard({ onUpdate });

    fireEvent.change(screen.getByRole("spinbutton", { name: "Bench Press set 1 actual weight" }), {
      target: { value: "140" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Complete Bench Press set 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate.mock.calls[0][1].exercise_blocks[0].actual_sets).toEqual([
      expect.objectContaining({
        planned_set_id: "set-1",
        actual_reps: 5,
        actual_weight: 140,
        completed: true,
      }),
    ]);
  });

  it("keeps replacement controls secondary and changes only the scheduled snapshot", async () => {
    const sourceSession = sessionWithBlocks([
      block("source", "bench_press", [plannedSet("source-1", 1, { target_reps: 5 })]),
    ]);
    const onUpdate = vi.fn().mockImplementation(async (_id, payload) => ({
      ...sourceSession,
      ...payload,
    }));
    renderDashboard({ week: { ...week, sessions: [sourceSession] }, onUpdate });

    expect(screen.queryByRole("combobox", { name: "Replace Bench Press" })).not.toBeInTheDocument();
    openExerciseEditor("Bench Press");
    fireEvent.change(screen.getByRole("combobox", { name: "Replace Bench Press" }), {
      target: { value: "farmers_walk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate.mock.calls[0][1].exercise_blocks[0].exercise_id).toBe("farmers_walk");
    expect(sourceSession.exercise_blocks[0].exercise_id).toBe("bench_press");
  });

  it("summarizes warm-up and conditioning blocks outside the editable exercise list", () => {
    const supplementalSession = sessionWithBlocks([
      { ...block("warm", "bench_press", [plannedSet("warm-1", 1, { target_reps: 5 }), plannedSet("warm-2", 2, { target_reps: 5 })]), label: "Warm-up A" },
      block("main", "chin_up", [plannedSet("main-1", 1, { target_reps: 5 })]),
      block("conditioning", "conditioning_run", [plannedSet("conditioning-1", 1, { target_duration_seconds: 300 })]),
    ]);
    renderDashboard({ week: { ...week, sessions: [supplementalSession] } });

    expect(screen.getByText("Warm-up A · 2 rounds")).toBeInTheDocument();
    expect(screen.getByText("Conditioning · 1 block")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Conditioning Run" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("region", { name: "Workout notes" })).toHaveLength(1);
  });

  it("uses one exercise-level max source for every percentage set", async () => {
    const percentageSession = sessionWithBlocks([
      block("percentage", "bench_press", [
        plannedSet("percentage-1", 1, { target_reps: 5, percentage: 55, max_source: "bench_press" }),
        plannedSet("percentage-2", 2, { target_reps: 5, percentage: 60, max_source: "bench_press" }),
      ]),
    ]);
    const onUpdate = vi.fn().mockImplementation(async (_id, payload) => ({
      ...percentageSession,
      ...payload,
    }));
    renderDashboard({ week: { ...week, sessions: [percentageSession] }, onUpdate });
    openExerciseEditor("Bench Press");

    expect(screen.getAllByRole("combobox", { name: "Bench Press max source" })).toHaveLength(1);
    fireEvent.change(screen.getByRole("combobox", { name: "Bench Press max source" }), {
      target: { value: "power_clean" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const payload = onUpdate.mock.calls[0][1];
    expect(payload.exercise_blocks[0].planned_sets).toEqual([
      expect.objectContaining({ set_number: 1, max_source: "power_clean" }),
      expect.objectContaining({ set_number: 2, max_source: "power_clean" }),
    ]);
  });

  it("defaults percentage mode from the exercise and copies useful set values", () => {
    renderDashboard();
    openExerciseEditor("Bench Press");
    const bench = within(screen.getByRole("region", { name: "Bench Press" }));

    fireEvent.click(bench.getByRole("button", { name: "+ Set" }));
    expect(bench.getByRole("spinbutton", { name: "Bench Press set 2 reps" })).toHaveValue(5);
    expect(bench.getByRole("spinbutton", { name: "Bench Press set 2 weight" })).toHaveValue(135);
    fireEvent.click(bench.getByRole("button", { name: "More options" }));
    expect(bench.getByRole("spinbutton", { name: "Bench Press set 2 rest seconds" })).toHaveValue(90);

    fireEvent.change(bench.getByRole("combobox", { name: "Bench Press prescription" }), {
      target: { value: "percentage" },
    });
    expect(bench.getByRole("combobox", { name: "Bench Press max source" })).toHaveValue("bench_press");
    expect(bench.getByRole("spinbutton", { name: "Bench Press set 1 percentage" })).toHaveValue(50);
    expect(bench.getByRole("spinbutton", { name: "Bench Press set 2 percentage" })).toHaveValue(50);
  });

  it("calculates dated percentage plans and stores execution separately", async () => {
    const percentageSession = sessionWithBlocks([
      block("percentage", "bench_press", [
        plannedSet("percentage-1", 1, { target_reps: 5, percentage: 55, max_source: "power_clean" }),
        plannedSet("percentage-2", 2, { target_reps: 5, percentage: 60, max_source: "power_clean" }),
        plannedSet("percentage-3", 3, { target_reps: 5, percentage: 65, max_source: "power_clean" }),
      ]),
    ]);
    const maxHistory = [
      {
        id: "clean-old",
        exercise_key: "power_clean",
        value: 200,
        effective_date: "2026-01-01",
        created_at: "2026-01-01T12:00:00Z",
      },
      {
        id: "clean-current",
        exercise_key: "power_clean",
        value: 225,
        effective_date: "2026-09-20",
        created_at: "2026-09-20T12:00:00Z",
      },
      {
        id: "clean-future",
        exercise_key: "power_clean",
        value: 300,
        effective_date: "2026-09-24",
        created_at: "2026-09-24T12:00:00Z",
      },
    ];
    const onUpdate = vi.fn().mockImplementation(async (_id, payload) => ({
      ...percentageSession,
      ...payload,
    }));
    renderDashboard({
      week: { ...week, sessions: [percentageSession] },
      maxHistory,
      onUpdate,
    });
    openExerciseEditor("Bench Press");

    const bench = within(screen.getByRole("region", { name: "Bench Press" }));
    expect(bench.getByRole("combobox", { name: "Bench Press max source" })).toHaveValue("power_clean");
    expect(bench.getByText("125 lb planned")).toBeInTheDocument();
    expect(bench.getByText("135 lb planned")).toBeInTheDocument();
    expect(bench.getByText("145 lb planned")).toBeInTheDocument();
    expect(bench.getByRole("spinbutton", { name: "Bench Press set 1 actual weight" })).toHaveValue(125);
    expect(bench.getByRole("spinbutton", { name: "Bench Press set 1 actual reps" })).toHaveValue(5);

    fireEvent.change(bench.getByRole("spinbutton", { name: "Bench Press set 1 actual weight" }), {
      target: { value: "150" },
    });
    fireEvent.change(bench.getByRole("spinbutton", { name: "Bench Press set 1 actual reps" }), {
      target: { value: "4" },
    });
    fireEvent.click(bench.getByRole("button", { name: "Complete Bench Press set 1" }));
    fireEvent.click(bench.getByRole("button", { name: "Complete Bench Press set 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const payload = onUpdate.mock.calls[0][1];
    expect(payload.exercise_blocks[0].planned_sets).toEqual([
      expect.objectContaining({ percentage: 55, max_source: "power_clean", max_value_at_creation: 225, target_weight: 125 }),
      expect.objectContaining({ percentage: 60, max_source: "power_clean", max_value_at_creation: 225, target_weight: 135 }),
      expect.objectContaining({ percentage: 65, max_source: "power_clean", max_value_at_creation: 225, target_weight: 145 }),
    ]);
    expect(payload.exercise_blocks[0].actual_sets).toEqual([
      expect.objectContaining({
        planned_set_id: "percentage-1",
        actual_weight: 150,
        actual_reps: 4,
        completed: true,
      }),
      expect.objectContaining({
        planned_set_id: "percentage-2",
        actual_weight: 135,
        actual_reps: 5,
        completed: true,
      }),
    ]);
  });

  it("keeps percentages visible when no effective max exists", async () => {
    const percentageSession = sessionWithBlocks([
      block("percentage", "bench_press", [
        plannedSet("percentage-1", 1, { target_reps: 5, percentage: 65, max_source: "power_clean" }),
      ]),
    ]);
    const onUpdate = vi.fn().mockImplementation(async (_id, payload) => ({ ...percentageSession, ...payload }));
    renderDashboard({
      week: { ...week, sessions: [percentageSession] },
      maxHistory: [{
        id: "future-only",
        exercise_key: "power_clean",
        value: 300,
        effective_date: "2026-09-24",
        created_at: "2026-09-24T12:00:00Z",
      }],
      onUpdate,
    });
    expect(screen.getByText("Set Power Clean max to calculate planned weights")).toBeInTheDocument();
    openExerciseEditor("Bench Press");
    expect(screen.getByRole("spinbutton", { name: "Bench Press set 1 percentage" })).toHaveValue(65);
    expect(screen.getByText("Planned weight —")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Bench Press set 1 reps" }), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate.mock.calls[0][1].exercise_blocks[0].planned_sets[0]).toEqual(
      expect.objectContaining({
        percentage: 65,
        max_source: "power_clean",
        max_value_at_creation: null,
        target_weight: null,
      }),
    );
  });

  it("normalizes blank optional controls and preserves a valid complex session payload", async () => {
    const malformed = sessionWithBlocks([
      block("complex", "bench_press", [
        plannedSet("complex-1", 1, {
          target_reps: 5,
          percentage: 65,
          max_source: "bench_press",
          max_value_at_creation: 265,
          target_weight: 172.5,
          target_distance: "" as unknown as number,
          distance_unit: "" as unknown as "yards",
          target_duration_seconds: "" as unknown as number,
          rest_seconds: "" as unknown as number,
        }),
      ], "" as unknown as string),
    ]);
    const onUpdate = vi.fn().mockImplementation(async (_id, payload) => ({ ...malformed, ...payload }));
    renderDashboard({ week: { ...week, sessions: [malformed] }, onUpdate });
    openExerciseEditor("Bench Press");

    fireEvent.change(screen.getByRole("spinbutton", { name: "Bench Press set 1 reps" }), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate.mock.calls[0][1].exercise_blocks[0]).toEqual(expect.objectContaining({
      label: null,
      planned_sets: [expect.objectContaining({
        target_reps: 6,
        percentage: 65,
        max_source: "bench_press",
        max_value_at_creation: 225,
        target_weight: 145,
        target_distance: null,
        distance_unit: null,
        target_duration_seconds: null,
        rest_seconds: null,
      })],
    }));
  });

  it("keeps local edits and displays backend validation detail after a failed save", async () => {
    const onUpdate = vi.fn().mockRejectedValue(new StrengthApiError(
      "Strength API request failed",
      422,
      "percentage and max source must be provided together",
    ));
    renderDashboard({ onUpdate });
    openExerciseEditor("Bench Press");

    const reps = screen.getByRole("spinbutton", { name: "Bench Press set 1 reps" });
    fireEvent.change(reps, { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "percentage and max source must be provided together",
    );
    expect(reps).toHaveValue(7);
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("adds and removes exercises and sets, reloads, and confirms deletion", async () => {
    const onReload = vi.fn().mockResolvedValue(upperSession);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderDashboard({ onReload, onDelete });

    fireEvent.click(screen.getByRole("button", { name: "+ Exercise" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search session exercises" }), {
      target: { value: "farmers_walk" },
    });
    expect(screen.getByText("No matching exercises")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search session exercises" }), {
      target: { value: "farmers" },
    });
    fireEvent.click(screen.getByRole("option", { name: "Farmers Walk" }));
    expect(screen.queryByRole("searchbox", { name: "Search session exercises" })).not.toBeInTheDocument();
    const farmersBlock = screen.getByRole("region", { name: "Farmers Walk" });
    openExerciseEditor("Farmers Walk");
    expect(within(farmersBlock).getByRole("spinbutton", { name: "Farmers Walk set 1 reps" })).toBeInTheDocument();
    fireEvent.change(within(farmersBlock).getByRole("spinbutton", { name: "Farmers Walk set 1 reps" }), {
      target: { value: "8" },
    });
    fireEvent.click(within(farmersBlock).getByRole("button", { name: "+ Set" }));
    expect(within(farmersBlock).getByRole("spinbutton", { name: "Farmers Walk set 2 reps" })).toHaveValue(8);
    fireEvent.click(within(farmersBlock).getByRole("button", { name: "Remove Farmers Walk set 1" }));
    expect(within(farmersBlock).getByRole("spinbutton", { name: "Farmers Walk set 1 reps" })).toHaveValue(8);
    fireEvent.click(within(farmersBlock).getByRole("button", { name: "Remove exercise" }));
    expect(screen.queryByRole("region", { name: "Farmers Walk" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(onReload).toHaveBeenCalledWith("session-1"));
    fireEvent.click(screen.getByRole("button", { name: "Delete session" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("session-1"));
  });
});

function renderDashboard(overrides: Partial<React.ComponentProps<typeof StrengthWeekDashboard>> = {}) {
  const props: React.ComponentProps<typeof StrengthWeekDashboard> = {
    week,
    exercises,
    maxSources: [
      { key: "bench_press", label: "Bench Press" },
      { key: "power_clean", label: "Power Clean" },
    ],
    maxHistory: [
      {
        id: "bench-2026",
        exercise_key: "bench_press",
        value: 225,
        effective_date: "2026-01-01",
        created_at: "2026-01-01T12:00:00Z",
      },
      {
        id: "clean-2026",
        exercise_key: "power_clean",
        value: 200,
        effective_date: "2026-01-01",
        created_at: "2026-01-01T12:00:00Z",
      },
    ],
    programs,
    programInstances: [],
    isCurrentWeek: true,
    isWeekLoading: false,
    weekError: null,
    onPreviousWeek: vi.fn(),
    onNextWeek: vi.fn(),
    onCurrentWeek: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(upperSession),
    onScheduleProgram: vi.fn().mockResolvedValue({ instance: {}, sessions: [] }),
    onUpdate: vi.fn().mockResolvedValue(upperSession),
    onReload: vi.fn().mockResolvedValue(upperSession),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return render(<StrengthWeekDashboard {...props} />);
}

function openExerciseEditor(name: string) {
  fireEvent.click(screen.getByRole("button", { name: `Edit ${name}` }));
}

function plannedSet(
  id: string,
  setNumber: number,
  values: Partial<PlannedSet>,
): PlannedSet {
  return {
    id,
    set_number: setNumber,
    target_reps: null,
    target_distance: null,
    distance_unit: null,
    target_duration_seconds: null,
    percentage: null,
    max_source: null,
    max_value_at_creation: null,
    target_weight: null,
    rest_seconds: null,
    ...values,
  };
}

function block(
  id: string,
  exerciseId: string,
  sets: PlannedSet[],
  label: string | null = null,
): ExerciseBlock {
  return {
    id,
    exercise_id: exerciseId,
    order: 1,
    group_id: null,
    label,
    planned_sets: sets,
    actual_sets: [],
  };
}

function sessionWithBlocks(blocks: ExerciseBlock[]): StrengthSession {
  return {
    ...upperSession,
    exercise_blocks: blocks.map((item, index) => ({ ...item, order: index + 1 })),
  };
}
