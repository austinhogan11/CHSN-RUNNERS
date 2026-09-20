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
  it("renders seven days, real workouts, rest days, and date-specific add controls", () => {
    renderList();

    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getAllByRole("button", { name: /Add session on/ })).toHaveLength(7);
    expect(screen.getAllByRole("article")).toHaveLength(7);
    const row = within(screen.getByRole("article", { name: "Easy Run on 2026-09-18" }));
    expect(row.getByRole("button", { name: "Edit Status" })).toHaveTextContent("Skipped");
    expect(row.getByRole("button", { name: "Edit Planned miles" })).toHaveTextContent("5.00 mi");
    expect(screen.getByText("Fri")).toBeInTheDocument();
    expect(screen.getByText("Sep 18")).toBeInTheDocument();
  });

  it("renders an empty week as seven presentation-only rest days", () => {
    renderList([]);
    expect(screen.getAllByRole("article")).toHaveLength(7);
    expect(screen.getAllByRole("heading", { name: "Rest" })).toHaveLength(7);
    expect(screen.getByRole("article", { name: "Rest on 2026-09-14" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Rest on 2026-09-20" })).toBeInTheDocument();
  });

  it("preserves multiple sessions on one date and edits only the selected session", async () => {
    const onUpdate = vi.fn();
    render(
      <StatefulList
        initial={[{ ...workout, id: "run-am", title: "Morning Run" }, { ...workout, id: "strength-pm", type: "strength", title: "Gym" }]}
        onUpdate={onUpdate}
      />,
    );

    const morning = within(screen.getByRole("article", { name: "Morning Run on 2026-09-18" }));
    fireEvent.click(morning.getByRole("button", { name: "Edit Title" }));
    enterValue("Title", "Recovery Run");

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("run-am", { title: "Recovery Run" }));
    expect(screen.getByRole("article", { name: "Gym on 2026-09-18" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Add session on 2026-09-18/ })).toHaveLength(1);
  });

  it("renders an explicit rest session as an editable persisted workout", () => {
    renderList([{ ...workout, id: "rest-1", type: "rest", title: null, planned_distance: null }]);
    const row = within(screen.getByRole("article", { name: "Rest on 2026-09-18" }));
    expect(row.getByRole("button", { name: "Edit Type" })).toHaveTextContent("Rest");
    expect(row.getByRole("button", { name: "Edit Status" })).toHaveTextContent("Skipped");
    expect(row.getByLabelText("Actions for Rest")).toBeInTheDocument();
  });

  it("identifies today using the local calendar date", () => {
    vi.stubEnv("TZ", "America/New_York");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-19T01:00:00Z"));
    renderList();
    expect(screen.getByText("Today")).toBeInTheDocument();
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

  it("uses Add note for an empty description and clears descriptions to null", async () => {
    const onUpdate = vi.fn(async () => {});
    const { unmount } = renderList([{ ...workout, description: "Keep this" }], onUpdate);
    edit("Description");
    enterValue("Description", "");
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("run-1", { description: null }));

    unmount();
    renderList();
    const addNote = screen.getByRole("button", { name: "Edit Description" });
    expect(addNote).toHaveTextContent("Add note");
    fireEvent.click(addNote);
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("");
  });

  it.each([
    ["Planned miles", "6.5", { planned_distance: 6.5 }],
    ["Actual miles", "4.25", { distance: 4.25 }],
  ])("patches only %s", async (label, value, changes) => {
    const onUpdate = vi.fn(async () => {});
    renderList([workout], onUpdate);
    edit(label as string);
    const input = screen.getByRole("spinbutton", { name: label as string });
    fireEvent.change(input, { target: { value } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("run-1", changes));
  });

  it("clears actual distance to null and rejects negative distance locally", async () => {
    const onUpdate = vi.fn(async () => {});
    const { unmount } = renderList([{ ...workout, distance: 4 }], onUpdate);
    edit("Actual miles");
    const actual = screen.getByRole("spinbutton", { name: "Actual miles" });
    fireEvent.change(actual, { target: { value: "" } });
    fireEvent.keyDown(actual, { key: "Enter" });
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("run-1", { distance: null }));
    unmount();

    const invalidUpdate = vi.fn(async () => {});
    renderList([workout], invalidUpdate);
    edit("Planned miles");
    const planned = screen.getByRole("spinbutton", { name: "Planned miles" });
    fireEvent.change(planned, { target: { value: "-1" } });
    fireEvent.keyDown(planned, { key: "Enter" });
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
    render(<StatefulList />);
    edit("Actual miles");
    const actual = screen.getByRole("spinbutton", { name: "Actual miles" });
    fireEvent.change(actual, { target: { value: "5" } });
    fireEvent.keyDown(actual, { key: "Enter" });
    await screen.findByRole("button", { name: "Edit Actual miles" });
    edit("Duration");
    enterValue("Duration", "40:00");
    expect(await screen.findByText("8:00 /mi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Avg. pace" })).not.toBeInTheDocument();
  });

  it.each([
    ["Type", "strength", { type: "strength" }],
    ["Status", "completed", { status: "completed" }],
  ])("saves %s immediately and patches only that selection", async (label, value, changes) => {
    const onUpdate = vi.fn(async () => {});
    renderList([workout], onUpdate);
    edit(label as string);
    fireEvent.change(screen.getByRole("combobox", { name: label as string }), { target: { value } });
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("run-1", changes));
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
    expect(screen.getByRole("button", { name: "Edit Planned miles" })).toBeEnabled();
  });

  it("has no session-wide Edit or Save controls", () => {
    renderList();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});

describe("compact session actions", () => {
  it("creates with only type, title, and planned fields and preserves run defaults", async () => {
    const onCreate = vi.fn(async () => {});
    render(<WorkoutList weekStart="2026-09-14" workouts={[]} onCreate={onCreate} onUpdate={noUpdate} onDelete={noDelete} />);
    fireEvent.click(screen.getByRole("button", { name: /Add session on 2026-09-16/ }));
    expect(screen.getByRole("combobox", { name: "Type" })).toHaveValue("run");
    expect(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Planned miles" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Actual miles")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Duration")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ date: "2026-09-16" }));
  });

  it("creates a useful non-default session", async () => {
    const onCreate = vi.fn(async () => {});
    render(<WorkoutList weekStart="2026-09-14" workouts={[]} onCreate={onCreate} onUpdate={noUpdate} onDelete={noDelete} />);
    fireEvent.click(screen.getByRole("button", { name: /Add session on 2026-09-15/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Type" }), { target: { value: "strength" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "  Gym  " } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Planned miles" }), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ date: "2026-09-15", type: "strength", title: "Gym", planned_distance: 2.5 }));
  });

  it("requires overflow confirmation and restores Rest after deleting the final session", async () => {
    render(<StatefulList />);
    fireEvent.click(screen.getByLabelText("Actions for Easy Run"));
    fireEvent.click(screen.getByRole("button", { name: "Delete session" }));
    const confirmation = screen.getByRole("group", { name: "Delete Easy Run" });
    expect(within(confirmation).getByText("Delete this session?")).toBeInTheDocument();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByRole("article", { name: "Rest on 2026-09-18" })).toBeInTheDocument();
  });
});
