import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StrengthSession, StrengthWeek } from "../types";
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
    fireEvent.click(screen.getByRole("button", { name: "+ Add session" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to create strength session",
    );

    fireEvent.click(screen.getByRole("button", { name: "+ Add session" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(2));
    expect(onCreate).toHaveBeenLastCalledWith({
      date: "2026-09-24",
      title: "Strength Session",
      notes: null,
      exercise_blocks: [],
    });
    expect(screen.getByRole("region", { name: /Thursday, Sep 24, 2026/ })).toHaveFocus();
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

  it("edits the full nested session, validates sets, and saves an explicit collection", async () => {
    const saved = { ...upperSession, title: "Upper Strength" };
    const onUpdate = vi.fn().mockResolvedValue(saved);
    renderDashboard({ onUpdate });

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
    fireEvent.change(screen.getByRole("spinbutton", { name: "Bench Press set 1 percentage" }), {
      target: { value: "55" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Bench Press set 1 max source" }), {
      target: { value: "bench_press" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Bench Press set 1 distance" }), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Bench Press set 1 distance unit" }), {
      target: { value: "yards" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Bench Press set 1 duration seconds" }), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Bench Press set 1 rest seconds" }), {
      target: { value: "120" },
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
              percentage: 55,
              max_source: "bench_press",
              target_distance: 20,
              distance_unit: "yards",
              target_duration_seconds: 30,
              rest_seconds: 120,
            }),
          ],
          actual_sets: [],
        }),
      ],
    });
  });

  it("adds and removes exercises and sets, reloads, and confirms deletion", async () => {
    const onReload = vi.fn().mockResolvedValue(upperSession);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderDashboard({ onReload, onDelete });

    fireEvent.click(screen.getByRole("button", { name: "+ Add exercise" }));
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
    fireEvent.click(within(farmersBlock).getByRole("button", { name: "+ Add set" }));
    expect(within(farmersBlock).getByRole("spinbutton", { name: "Farmers Walk set 1 reps" })).toBeInTheDocument();
    fireEvent.click(within(farmersBlock).getByRole("button", { name: "Remove Farmers Walk set 1" }));
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
    maxSources: [{ key: "bench_press", label: "Bench Press" }],
    isCurrentWeek: true,
    isWeekLoading: false,
    weekError: null,
    onPreviousWeek: vi.fn(),
    onNextWeek: vi.fn(),
    onCurrentWeek: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(upperSession),
    onUpdate: vi.fn().mockResolvedValue(upperSession),
    onReload: vi.fn().mockResolvedValue(upperSession),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return render(<StrengthWeekDashboard {...props} />);
}
