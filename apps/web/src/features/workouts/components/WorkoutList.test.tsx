import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Workout, WorkoutUpdate } from "../types";
import { WorkoutList } from "./WorkoutList";

const workout: Workout = {
  id: "run-1",
  date: "2026-09-18",
  type: "run",
  title: "Easy Run",
  description: null,
  planned_distance: 5,
  start_time: null,
  duration_seconds: null,
  distance: null,
  status: "skipped",
};

const noCreate = async () => {};
const noUpdate = async () => {};
const noDelete = async () => {};

function renderList(workouts: Workout[] = [workout], onUpdate = noUpdate) {
  return render(
    <WorkoutList weekStart="2026-09-14" workouts={workouts} onCreate={noCreate} onUpdate={onUpdate} onDelete={noDelete} />,
  );
}

function StatefulList({ initial = [workout], onUpdate }: { initial?: Workout[]; onUpdate?: (id: string, changes: WorkoutUpdate) => void }) {
  const [sessions, setSessions] = useState(initial);
  return (
    <WorkoutList
      weekStart="2026-09-14"
      workouts={sessions}
      onCreate={noCreate}
      onDelete={async (id) => setSessions((current) => current.filter((session) => session.id !== id))}
      onUpdate={async (id, changes) => {
        onUpdate?.(id, changes);
        setSessions((current) => current.map((session) => session.id === id ? { ...session, ...changes } : session));
      }}
    />
  );
}

function edit(label: string) {
  fireEvent.click(screen.getByRole("button", { name: `Edit ${label}` }));
}

function enterValue(label: string, value: string) {
  const input = screen.getByRole("textbox", { name: label });
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
  return input;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("WorkoutList presentation", () => {
  it("renders a Monday-through-Sunday board and compact session rows", () => {
    const { container } = renderList([{
      ...workout,
      description: "Hidden details",
      start_time: "07:12:00",
      distance: 5,
      duration_seconds: 2400,
      status: "completed",
    }]);

    const days = Array.from(container.querySelectorAll(".workout-day"));
    expect(days).toHaveLength(7);
    expect(days.map((day) => day.querySelector(".workout-date span")?.textContent)).toEqual([
      "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
    ]);
    expect(days.map((day) => day.querySelector(".workout-date strong")?.textContent)).toEqual([
      "Sep 14", "Sep 15", "Sep 16", "Sep 17", "Sep 18", "Sep 19", "Sep 20",
    ]);
    expect(container.querySelector(".workout-table-header")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Add session for/ })).toHaveLength(7);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    const row = within(screen.getByRole("article", { name: "Easy Run on 2026-09-18" }));
    expect(row.getByRole("button", { name: "Edit Title" }).closest("article")).toHaveClass("session-row");
    expect(row.getByRole("button", { name: "Edit Title" }).closest(".workout-day")).toHaveTextContent("Sep 18");
    expect(row.getByRole("button", { name: "Delete Easy Run" }).parentElement).toHaveClass("session-actions");
    expect(row.queryByRole("combobox", { name: "Edit Type" })).not.toBeInTheDocument();
    expect(row.queryByRole("combobox", { name: "Edit Status" })).not.toBeInTheDocument();
    expect(row.queryByText("Hidden details")).not.toBeInTheDocument();
    expect(row.getByRole("button", { name: "Edit Start time" })).toHaveTextContent("7:12 AM");
    expect(row.getByRole("button", { name: "Edit Distance" })).toHaveTextContent("5.00");
    expect(row.getByRole("button", { name: "Edit Duration" })).toHaveTextContent("40:00");
    expect(row.getByLabelText("Average pace")).toHaveTextContent("8:00");
    for (const hiddenValue of [/^run$/i, /^completed$/i, /^planned$/i, /^actual$/i]) {
      expect(row.queryByText(hiddenValue)).not.toBeInTheDocument();
    }
  });

  it("renders an empty week as seven clean day columns with add actions only", () => {
    const { container } = renderList([]);
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.queryByRole("heading", { name: "Rest" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Add session for/ })).toHaveLength(7);
    const mondayAdd = screen.getByRole("button", { name: "Add session for Sep 14" });
    expect(mondayAdd).toHaveTextContent("+");
    expect(mondayAdd.closest(".day-sessions")?.children).toHaveLength(1);
    expect(container).not.toHaveTextContent("Rest");
  });

  it("preserves multiple sessions on one date and edits only the selected session", async () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <StatefulList
        initial={[{ ...workout, id: "run-am", title: "Morning Run", start_time: "07:12:00" }, { ...workout, id: "strength-pm", type: "strength", title: "Gym", start_time: "18:15:00" }]}
        onUpdate={onUpdate}
      />,
    );

    const morning = within(screen.getByRole("article", { name: "Morning Run on 2026-09-18" }));
    fireEvent.click(morning.getByRole("button", { name: "Edit Title" }));
    enterValue("Title", "Recovery Run");

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("run-am", { title: "Recovery Run" }));
    expect(screen.getByRole("article", { name: "Gym on 2026-09-18" })).toBeInTheDocument();
    expect(screen.getByText("7:12 AM")).toBeInTheDocument();
    expect(screen.getByText("6:15 PM")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Add session for Sep 18/ })).toHaveLength(1);
    expect(container.querySelectorAll('time[datetime="2026-09-18"]')).toHaveLength(1);
    expect(screen.getByText("2 workouts this week")).toBeInTheDocument();
  });

  it("renders an explicit rest session as an editable persisted workout", () => {
    renderList([{ ...workout, id: "rest-1", type: "rest", title: null, planned_distance: null }]);
    const row = within(screen.getByRole("article", { name: "Rest on 2026-09-18" }));
    expect(row.getByRole("button", { name: "Edit Title" })).toHaveTextContent("Rest");
    expect(row.queryByRole("combobox", { name: "Edit Type" })).not.toBeInTheDocument();
    expect(row.queryByRole("combobox", { name: "Edit Status" })).not.toBeInTheDocument();
    expect(row.getByRole("button", { name: "Delete Rest" })).toHaveTextContent("×");
  });

  it("identifies today using the local calendar date", () => {
    vi.stubEnv("TZ", "America/New_York");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-19T01:00:00Z"));
    renderList();
    expect(screen.getByText("Today").closest("li")).toHaveClass("is-today");
  });
});

describe("direct field editing", () => {
  it("edits a title in place and saves only that field with Enter", async () => {
    const onUpdate = vi.fn(async () => {});
    renderList([workout], onUpdate);
    edit("Title");
    enterValue("Title", "  Recovery Run  ");
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("run-1", { title: "Recovery Run" }));
  });

  it("cancels an edit with Escape without patching", () => {
    const onUpdate = vi.fn(async () => {});
    renderList([workout], onUpdate);
    edit("Title");
    const input = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(input, { target: { value: "Discard me" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit Title" })).toHaveTextContent("Easy Run");
  });

  it("preserves a failed field value and shows its error beside that editor", async () => {
    const onUpdate = vi.fn(async () => { throw new Error("unavailable"); });
    renderList([workout], onUpdate);
    edit("Title");
    const input = enterValue("Title", "Still here");
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to complete that change");
    expect(input).toHaveValue("Still here");
  });

  it("shows actual distance before planned distance and edits the executed value", async () => {
    const onUpdate = vi.fn(async () => {});
    renderList([{ ...workout, planned_distance: 6, distance: 5.25 }], onUpdate);
    expect(screen.getByRole("button", { name: "Edit Distance" })).toHaveTextContent("5.25");
    edit("Distance");
    const input = screen.getByRole("spinbutton", { name: "Distance" });
    fireEvent.change(input, { target: { value: "5.5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("run-1", { distance: 5.5 }));
  });

  it("shows and edits planned distance when execution data is absent", async () => {
    const onUpdate = vi.fn(async () => {});
    renderList([workout], onUpdate);
    expect(screen.getByRole("button", { name: "Edit Distance" })).toHaveTextContent("5.00");
    edit("Distance");
    const input = screen.getByRole("spinbutton", { name: "Distance" });
    fireEvent.change(input, { target: { value: "6.5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("run-1", { planned_distance: 6.5 }));
  });

  it("edits actual distance when duration alone marks a workout executed", async () => {
    const onUpdate = vi.fn(async () => {});
    renderList([{ ...workout, duration_seconds: 1800 }], onUpdate);
    edit("Distance");
    const input = screen.getByRole("spinbutton", { name: "Distance" });
    fireEvent.change(input, { target: { value: "4.25" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("run-1", { distance: 4.25 }));
  });

  it("shows an empty distance and rejects negative distance locally", async () => {
    const onUpdate = vi.fn(async () => {});
    const { unmount } = renderList([{ ...workout, planned_distance: null }], onUpdate);
    expect(screen.getByRole("button", { name: "Edit Distance" })).toHaveTextContent("—");
    unmount();

    const invalidUpdate = vi.fn(async () => {});
    renderList([workout], invalidUpdate);
    edit("Distance");
    const distance = screen.getByRole("spinbutton", { name: "Distance" });
    fireEvent.change(distance, { target: { value: "-1" } });
    fireEvent.keyDown(distance, { key: "Enter" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Distance must be zero or greater");
    expect(invalidUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ["41:05", 2465],
    ["1:02:18", 3738],
  ])("converts duration %s to seconds", async (value, seconds) => {
    const onUpdate = vi.fn(async () => {});
    renderList([workout], onUpdate);
    edit("Duration");
    enterValue("Duration", value as string);
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("run-1", { duration_seconds: seconds }));
  });

  it("keeps an invalid duration open without patching", async () => {
    const onUpdate = vi.fn(async () => {});
    renderList([workout], onUpdate);
    edit("Duration");
    const duration = enterValue("Duration", "1:99");
    expect(await screen.findByRole("alert")).toHaveTextContent("Minutes and seconds must be below 60");
    expect(duration).toHaveValue("1:99");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("keeps pace derived and updates it after distance and duration changes", async () => {
    render(<StatefulList initial={[{ ...workout, distance: 5 }]} />);
    edit("Duration");
    enterValue("Duration", "40:00");
    expect(await screen.findByText("8:00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Avg. pace" })).not.toBeInTheDocument();
  });

  it("edits and clears start time", async () => {
    const onUpdate = vi.fn(async () => {});
    const { unmount } = renderList([workout], onUpdate);
    edit("Start time");
    const start = screen.getByLabelText("Start time");
    fireEvent.change(start, { target: { value: "06:30" } });
    fireEvent.keyDown(start, { key: "Enter" });
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("run-1", { start_time: "06:30" }));
    unmount();

    const clearUpdate = vi.fn(async () => {});
    renderList([{ ...workout, start_time: "06:30:00" }], clearUpdate);
    expect(screen.getByRole("button", { name: "Edit Start time" })).toHaveTextContent("6:30 AM");
    edit("Start time");
    const existing = screen.getByLabelText("Start time");
    fireEvent.change(existing, { target: { value: "" } });
    fireEvent.keyDown(existing, { key: "Enter" });
    await waitFor(() => expect(clearUpdate).toHaveBeenCalledWith("run-1", { start_time: null }));
  });

  it("prevents duplicate saves and scopes pending state to the active field", () => {
    const onUpdate = vi.fn(() => new Promise<void>(() => {}));
    renderList([workout], onUpdate);
    edit("Title");
    const title = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(title, { target: { value: "Pending" } });
    fireEvent.keyDown(title, { key: "Enter" });
    fireEvent.keyDown(title, { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("Saving...");
    expect(screen.getByRole("button", { name: "Edit Distance" })).toBeEnabled();
  });

  it("has no session-wide Edit or Save controls", () => {
    renderList();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});

describe("compact session actions", () => {
  it("keeps creation compact and defaults start time from the local clock", async () => {
    vi.stubEnv("TZ", "America/New_York");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-21T19:42:00Z"));
    const onCreate = vi.fn(async () => {});
    render(<WorkoutList weekStart="2026-09-14" workouts={[]} onCreate={onCreate} onUpdate={noUpdate} onDelete={noDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Add session for Sep 16" }));
    const addRow = screen.getByRole("form", { name: "New session on 2026-09-16" });
    expect(within(addRow).queryByRole("combobox", { name: "Type" })).not.toBeInTheDocument();
    expect(within(addRow).getByRole("textbox", { name: "Title" })).toHaveAttribute("placeholder", "Workout title...");
    expect(within(addRow).getByRole("spinbutton", { name: "Distance" })).toHaveAttribute("placeholder", "5.0");
    expect(within(addRow).getByRole("textbox", { name: "Duration (optional)" })).toHaveAttribute("placeholder", "MM:SS optional");
    expect(within(addRow).getByRole("button", { name: "Cancel adding session" })).toHaveTextContent("×");
    expect(screen.queryByLabelText("Actual miles")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Edit Status" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({
      date: "2026-09-16",
      start_time: "15:42",
      distance: null,
      duration_seconds: null,
    }));
  });

  it("creates a planned-only session with null execution values when duration is blank", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-21T12:05:00"));
    const onCreate = vi.fn(async () => {});
    render(<WorkoutList weekStart="2026-09-14" workouts={[]} onCreate={onCreate} onUpdate={noUpdate} onDelete={noDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Add session for Sep 15" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "  Gym  " } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Distance" }), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({
      date: "2026-09-15",
      title: "Gym",
      planned_distance: 2.5,
      start_time: "12:05",
      distance: null,
      duration_seconds: null,
    }));
  });

  it("copies distance into actual execution when duration is provided", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-21T06:30:00"));
    const onCreate = vi.fn(async () => {});
    render(<WorkoutList weekStart="2026-09-14" workouts={[]} onCreate={onCreate} onUpdate={noUpdate} onDelete={noDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Add session for Sep 17" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Distance" }), { target: { value: "5" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Duration (optional)" }), { target: { value: "40:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({
      date: "2026-09-17",
      planned_distance: 5,
      distance: 5,
      duration_seconds: 2400,
      start_time: "06:30",
    }));
  });

  it("allows duration-only execution without inventing distance", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-21T18:10:00"));
    const onCreate = vi.fn(async () => {});
    render(<WorkoutList weekStart="2026-09-14" workouts={[]} onCreate={onCreate} onUpdate={noUpdate} onDelete={noDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Add session for Sep 18" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Duration (optional)" }), { target: { value: "35:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({
      date: "2026-09-18",
      start_time: "18:10",
      distance: null,
      duration_seconds: 2100,
    }));
  });

  it("uses a direct delete control, requires confirmation, and restores the empty day", async () => {
    render(<StatefulList />);
    const deleteButton = screen.getByRole("button", { name: "Delete Easy Run" });
    expect(deleteButton).toHaveTextContent("×");
    expect(screen.queryByText("⋯")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Actions for Easy Run")).not.toBeInTheDocument();
    fireEvent.click(deleteButton);
    expect(screen.getByRole("article", { name: "Easy Run on 2026-09-18" })).toBeInTheDocument();
    const confirmation = screen.getByRole("group", { name: "Delete Easy Run" });
    expect(within(confirmation).getByText("Delete this session?")).toBeInTheDocument();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.queryByRole("article", { name: "Easy Run on 2026-09-18" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Add session for Sep 18" })).toBeInTheDocument();
  });

  it("cancels direct delete confirmation with Escape", () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Delete Easy Run" }));
    const confirmation = screen.getByRole("group", { name: "Delete Easy Run" });
    fireEvent.keyDown(within(confirmation).getByRole("button", { name: "Confirm" }), { key: "Escape" });
    expect(screen.getByRole("button", { name: "Delete Easy Run" })).toBeInTheDocument();
  });
});
