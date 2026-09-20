import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Workout } from "../types";
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

function renderList(workouts: Workout[] = [workout]) {
  return render(
    <WorkoutList
      weekStart="2026-09-14"
      workouts={workouts}
      onCreate={noCreate}
      onUpdate={noUpdate}
      onDelete={noDelete}
    />,
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("WorkoutList", () => {
  it("renders all seven days with real workout details, rest days, and add controls", () => {
    renderList();

    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getAllByRole("button", { name: /Add session on/ })).toHaveLength(7);
    expect(screen.getAllByRole("article")).toHaveLength(7);
    const row = within(screen.getByRole("article", { name: "Easy Run on 2026-09-18" }));
    expect(row.getByText("Skipped")).toBeInTheDocument();
    expect(row.getAllByText("—")).toHaveLength(3);
    expect(screen.getByText("Fri")).toBeInTheDocument();
    expect(screen.getByText("Sep 18")).toBeInTheDocument();

    const rest = within(screen.getByRole("article", { name: "Rest on 2026-09-14" }));
    expect(rest.getByRole("heading", { name: "Rest" })).toBeInTheDocument();
    expect(rest.queryByRole("definition")).not.toBeInTheDocument();
  });

  it("renders an entirely empty week as seven presentation-only rest days", () => {
    renderList([]);

    expect(screen.getAllByRole("article")).toHaveLength(7);
    expect(screen.getAllByRole("heading", { name: "Rest" })).toHaveLength(7);
    expect(screen.getByRole("article", { name: "Rest on 2026-09-14" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Rest on 2026-09-20" })).toBeInTheDocument();
  });

  it("shows existing human-readable duration and derives pace", () => {
    renderList([{ ...workout, duration_seconds: 2460, distance: 5.1, status: "completed" }]);

    const row = within(screen.getByRole("article", { name: "Easy Run on 2026-09-18" }));
    expect(row.getByText("41:00")).toBeInTheDocument();
    expect(row.getByText("8:02 /mi")).toBeInTheDocument();
  });

  it("preserves multiple sessions on the same date", () => {
    renderList([
      { ...workout, id: "run-am", title: "Morning Run" },
      { ...workout, id: "strength-pm", type: "strength", title: null },
    ]);

    expect(screen.getAllByRole("article")).toHaveLength(8);
    expect(screen.getByRole("article", { name: "Morning Run on 2026-09-18" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Strength on 2026-09-18" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Add session on 2026-09-18/ })).toHaveLength(1);
  });

  it("renders an explicit rest session as a persisted workout", () => {
    renderList([{ ...workout, id: "rest-1", type: "rest", title: null, planned_distance: null }]);

    const row = within(screen.getByRole("article", { name: "Rest on 2026-09-18" }));
    expect(row.getByText("Skipped")).toBeInTheDocument();
    expect(row.getAllByText("—")).toHaveLength(4);
    expect(row.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("identifies today using the local calendar date", () => {
    vi.stubEnv("TZ", "America/New_York");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-19T01:00:00Z"));
    renderList([{ ...workout, status: "planned" }]);

    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("opens date-specific creation with run defaults and permits date-only save", async () => {
    const onCreate = vi.fn(async () => {});
    render(
      <WorkoutList
        weekStart="2026-09-14"
        workouts={[]}
        onCreate={onCreate}
        onUpdate={noUpdate}
        onDelete={noDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Add session on 2026-09-16/ }));
    expect(screen.getByRole("combobox", { name: "Type" })).toHaveValue("run");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ date: "2026-09-16" }));
    expect(screen.queryByRole("combobox", { name: "Type" })).not.toBeInTheDocument();
  });

  it("creates a useful session with type, title, and planned distance", async () => {
    const onCreate = vi.fn(async () => {});
    render(
      <WorkoutList weekStart="2026-09-14" workouts={[]} onCreate={onCreate} onUpdate={noUpdate} onDelete={noDelete} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Add session on 2026-09-15/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Type" }), { target: { value: "strength" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "  Gym  " } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Planned miles" }), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({
      date: "2026-09-15",
      type: "strength",
      title: "Gym",
      planned_distance: 2.5,
    }));
  });

  it("patches only an edited title", async () => {
    const onUpdate = vi.fn(async () => {});
    render(
      <WorkoutList weekStart="2026-09-14" workouts={[workout]} onCreate={noCreate} onUpdate={onUpdate} onDelete={noDelete} />,
    );

    fireEvent.click(within(screen.getByRole("article", { name: "Easy Run on 2026-09-18" })).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Recovery Run" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("run-1", { title: "Recovery Run" }));
  });

  it("patches only an edited planned distance", async () => {
    const onUpdate = vi.fn(async () => {});
    render(
      <WorkoutList weekStart="2026-09-14" workouts={[workout]} onCreate={noCreate} onUpdate={onUpdate} onDelete={noDelete} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Planned miles" }), { target: { value: "6.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("run-1", { planned_distance: 6.5 }));
  });

  it("logs completion values, converts duration, and renders updated pace", async () => {
    function Harness() {
      const [sessions, setSessions] = useState([workout]);
      return (
        <WorkoutList
          weekStart="2026-09-14"
          workouts={sessions}
          onCreate={noCreate}
          onDelete={noDelete}
          onUpdate={async (id, changes) => {
            setSessions((current) => current.map((session) => (
              session.id === id ? { ...session, ...changes } : session
            )));
          }}
        />
      );
    }
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "completed" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Type" }), { target: { value: "other" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Actual miles" }), { target: { value: "8.14" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Duration" }), { target: { value: "1:02:18" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const row = within(await screen.findByRole("article", { name: "Easy Run on 2026-09-18" }));
    expect(row.getByText("Completed")).toBeInTheDocument();
    expect(row.getByText("Other")).toBeInTheDocument();
    expect(row.getByText("8.14 mi")).toBeInTheDocument();
    expect(row.getByText("1:02:18")).toBeInTheDocument();
    expect(row.getByText("7:39 /mi")).toBeInTheDocument();
  });

  it("sends null when a nullable field is explicitly cleared", async () => {
    const onUpdate = vi.fn(async () => {});
    render(
      <WorkoutList weekStart="2026-09-14" workouts={[workout]} onCreate={noCreate} onUpdate={onUpdate} onDelete={noDelete} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("run-1", { title: null }));
  });

  it("rejects invalid duration locally and preserves the entered value", async () => {
    const onUpdate = vi.fn(async () => {});
    render(
      <WorkoutList weekStart="2026-09-14" workouts={[workout]} onCreate={noCreate} onUpdate={onUpdate} onDelete={noDelete} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const duration = screen.getByRole("textbox", { name: "Duration" });
    fireEvent.change(duration, { target: { value: "1:99" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Minutes and seconds must be below 60");
    expect(duration).toHaveValue("1:99");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("shows mutation errors without discarding edits", async () => {
    const onUpdate = vi.fn(async () => { throw new Error("unavailable"); });
    render(
      <WorkoutList weekStart="2026-09-14" workouts={[workout]} onCreate={noCreate} onUpdate={onUpdate} onDelete={noDelete} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const title = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(title, { target: { value: "Still here" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to complete that change");
    expect(title).toHaveValue("Still here");
  });

  it("disables create submission while the request is pending", () => {
    const onCreate = vi.fn(() => new Promise<void>(() => {}));
    render(
      <WorkoutList weekStart="2026-09-14" workouts={[]} onCreate={onCreate} onUpdate={noUpdate} onDelete={noDelete} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Add session on 2026-09-14/ }));
    const add = screen.getByRole("button", { name: "Add" });
    fireEvent.click(add);

    expect(screen.getByRole("button", { name: "Adding..." })).toBeDisabled();
    fireEvent.submit(screen.getByRole("button", { name: "Adding..." }).closest("form")!);
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("requires confirmation and restores Rest after deleting the final session", async () => {
    const onDelete = vi.fn(async (id: string) => { void id; });
    function Harness() {
      const [sessions, setSessions] = useState([workout]);
      return (
        <WorkoutList
          weekStart="2026-09-14"
          workouts={sessions}
          onCreate={noCreate}
          onUpdate={noUpdate}
          onDelete={async (id) => {
            await onDelete(id);
            setSessions((current) => current.filter((session) => session.id !== id));
          }}
        />
      );
    }
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).not.toHaveBeenCalled();
    const confirmation = screen.getByRole("group", { name: "Delete Easy Run" });
    expect(within(confirmation).getByText("Delete this session?")).toBeInTheDocument();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("run-1"));
    expect(await screen.findByRole("article", { name: "Rest on 2026-09-18" })).toBeInTheDocument();
  });
});
