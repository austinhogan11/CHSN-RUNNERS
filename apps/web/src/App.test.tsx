import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const clerk = vi.hoisted(() => ({
  getToken: vi.fn(() => Promise.resolve<string | null>("session-token")),
  signedIn: true,
}));

vi.mock("@clerk/react", () => ({
  Show: ({ children, when }: { children: ReactNode; when: "signed-in" | "signed-out" }) => {
    const visible = when === "signed-in" ? clerk.signedIn : !clerk.signedIn;
    return visible ? children : null;
  },
  SignIn: () => <div aria-label="Clerk sign in">Google sign in</div>,
  UserButton: () => <button aria-label="Account menu">Account</button>,
  useAuth: () => ({ getToken: clerk.getToken }),
}));

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
  clerk.signedIn = true;
  clerk.getToken.mockReset();
  clerk.getToken.mockResolvedValue("session-token");
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("App", () => {
  it("shows the Runner sign-in experience while signed out", () => {
    clerk.signedIn = false;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(screen.getByRole("heading", { name: "Sign in to Runner" })).toBeInTheDocument();
    expect(screen.getByText("Continue with Google to view your training.")).toBeInTheDocument();
    expect(screen.getByLabelText("Clerk sign in")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows loading state while dashboard data is being fetched", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    render(<App />);

    expect(
      screen.getByText("Loading dashboard..."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
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

    const workouts = within(screen.getByRole("region", { name: "Workouts" }));
    expect(workouts.getByText("Sep 14–20, 2026")).toBeInTheDocument();
    expect(workouts.getByRole("button", { name: "Previous week" })).toBeInTheDocument();
    expect(workouts.getByRole("button", { name: "Next week" })).toBeInTheDocument();

    const run = within(screen.getByRole("article", { name: "Easy Run on 2026-09-14" }));
    for (const value of ["Easy Run", "5.10 mi", "41:00", "8:02 /mi"]) {
      expect(run.getByText(value)).toBeInTheDocument();
    }
    expect(run.queryByText("Keep it relaxed")).not.toBeInTheDocument();
    expect(run.queryByRole("combobox", { name: "Edit Type" })).not.toBeInTheDocument();
    expect(run.queryByRole("combobox", { name: "Edit Status" })).not.toBeInTheDocument();
    expect(run.queryByText("Completed")).not.toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Sep 14")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select Tuesday, Sep 15" }));
    const plannedRun = within(screen.getByRole("article", { name: "Workout on 2026-09-15" }));
    expect(plannedRun.getByRole("button", { name: "Edit Distance" })).toHaveTextContent("7.00 mi");
    expect(plannedRun.queryByRole("combobox", { name: "Edit Status" })).not.toBeInTheDocument();
    expect(plannedRun.getAllByText("—")).toHaveLength(2);
    expect(plannedRun.getByRole("button", { name: "Edit Start time" })).toHaveTextContent("Add time");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.queryByRole("article", { name: "Easy Run on 2026-09-14" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Rest" })).not.toBeInTheDocument();

    expect(within(workouts.getByText("Weekly mileage").parentElement!).getByText("5.10 mi")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /This Week|Week Summary/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Planned mileage")).not.toBeInTheDocument();
    expect(screen.queryByText("Actual mileage")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Actual weekly mileage/ })).toBeInTheDocument();
    expect(clerk.getToken).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/(weeks|trends\/mileage)/),
      { headers: { Authorization: "Bearer session-token" } },
    );
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

    expect(await screen.findAllByRole("button", { name: /Select .*Oct/ })).toHaveLength(7);
    expect(screen.getByRole("button", { name: "Add workout for Oct 5" })).toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(
      screen.getByRole("heading", { name: "Weekly Mileage Trend" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Actual weekly mileage/ })).toBeInTheDocument();
    fireEvent.click(screen.getByText("View weekly data"));
    expect(within(screen.getByRole("table")).getByText("5.10 mi")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).queryByText("30.00 mi")).not.toBeInTheDocument();

    const workouts = within(screen.getByRole("region", { name: "Workouts" }));
    expect(within(workouts.getByText("Weekly mileage").parentElement!).getByText("0.00 mi")).toBeInTheDocument();
    expect(screen.queryByText("Easy Run")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Unable to load runner dashboard."),
    ).not.toBeInTheDocument();
  });

  it("creates a session and refreshes the week totals and trend", async () => {
    vi.stubEnv("TZ", "America/New_York");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-21T19:42:00Z"));
    const emptyWeek = {
      week_start: "2026-09-14",
      planned_distance: 0,
      actual_distance: 0,
      workouts: [],
    };
    const createdWorkout = {
      ...weekResponse.workouts[1],
      id: "workout-new",
      date: "2026-09-16",
      title: "Tempo Run",
      planned_distance: 6,
      start_time: "15:42:00",
    };
    const refreshedWeek = {
      week_start: "2026-09-14",
      planned_distance: 6,
      actual_distance: 0,
      workouts: [createdWorkout],
    };
    const refreshedTrend = trendResponse.map((point) => (
      point.week_start === "2026-09-14"
        ? { ...point, planned_distance: 6, actual_distance: 0 }
        : point
    ));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => emptyWeek })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => trendResponse })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => createdWorkout })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => refreshedWeek })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => refreshedTrend });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Wednesday, Sep 16" }));
    fireEvent.click(screen.getByRole("button", { name: "Add workout for Sep 16" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Tempo Run" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Distance" }), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const row = within(await screen.findByRole("article", { name: "Tempo Run on 2026-09-16" }));
    expect(row.getByRole("button", { name: "Edit Distance" })).toHaveTextContent("6.00 mi");
    expect(row.getByRole("button", { name: "Edit Duration" })).toHaveTextContent("—");
    expect(row.getByLabelText("Average pace")).toHaveTextContent("—");
    const workouts = within(screen.getByRole("region", { name: "Workouts" }));
    expect(within(workouts.getByText("Weekly mileage").parentElement!).getByText("0.00 mi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Wednesday, Sep 16" })).toHaveTextContent("6.00 mi");
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/workouts", {
      method: "POST",
      headers: {
        Authorization: "Bearer session-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: "2026-09-16",
        start_time: "15:42",
        distance: null,
        duration_seconds: null,
        title: "Tempo Run",
        planned_distance: 6,
      }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("creates completed mileage with duration and immediately derives pace", async () => {
    vi.stubEnv("TZ", "America/New_York");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-21T19:42:00Z"));
    const emptyWeek = {
      week_start: "2026-09-14",
      planned_distance: 0,
      actual_distance: 0,
      workouts: [],
    };
    const createdWorkout = {
      ...weekResponse.workouts[1],
      id: "workout-completed",
      date: "2026-09-17",
      title: "Tempo Run",
      planned_distance: 6,
      start_time: "15:42:00",
      duration_seconds: 2400,
      distance: 6,
      status: "completed",
    };
    const refreshedWeek = {
      week_start: "2026-09-14",
      planned_distance: 6,
      actual_distance: 6,
      workouts: [createdWorkout],
    };
    const refreshedTrend = trendResponse.map((point) => (
      point.week_start === "2026-09-14"
        ? { ...point, planned_distance: 6, actual_distance: 6 }
        : point
    ));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => emptyWeek })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => trendResponse })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => createdWorkout })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => refreshedWeek })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => refreshedTrend });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Thursday, Sep 17" }));
    fireEvent.click(screen.getByRole("button", { name: "Add workout for Sep 17" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Tempo Run" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Distance" }), { target: { value: "6" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Duration (optional)" }), { target: { value: "40:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const row = within(await screen.findByRole("article", { name: "Tempo Run on 2026-09-17" }));
    expect(row.getByRole("button", { name: "Edit Distance" })).toHaveTextContent("6.00 mi");
    expect(row.getByRole("button", { name: "Edit Duration" })).toHaveTextContent("40:00");
    expect(row.getByLabelText("Average pace")).toHaveTextContent("6:40 /mi");
    const workouts = within(screen.getByRole("region", { name: "Workouts" }));
    expect(within(workouts.getByText("Weekly mileage").parentElement!).getByText("6.00 mi")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/workouts", {
      method: "POST",
      headers: {
        Authorization: "Bearer session-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: "2026-09-17",
        start_time: "15:42",
        distance: 6,
        duration_seconds: 2400,
        title: "Tempo Run",
        planned_distance: 6,
      }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("counts actual data immediately and refreshes week and trend without a status edit", async () => {
    const durationOnlyWorkout = {
      ...weekResponse.workouts[1],
      duration_seconds: 2700,
      status: "completed",
    };
    const initialWeek = {
      ...weekResponse,
      workouts: [weekResponse.workouts[0], durationOnlyWorkout],
    };
    const updatedWorkout = {
      ...durationOnlyWorkout,
      distance: 8,
      status: "completed",
    };
    const refreshedWeek = {
      ...weekResponse,
      actual_distance: 13.1,
      workouts: [weekResponse.workouts[0], updatedWorkout],
    };
    const refreshedTrend = trendResponse.map((point) => (
      point.week_start === "2026-09-14"
        ? { ...point, actual_distance: 13.1 }
        : point
    ));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => initialWeek })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => trendResponse })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => updatedWorkout })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => refreshedWeek })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => refreshedTrend });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Tuesday, Sep 15" }));
    const row = within(screen.getByRole("article", { name: "Workout on 2026-09-15" }));
    fireEvent.click(row.getByRole("button", { name: "Edit Distance" }));
    const input = row.getByRole("spinbutton", { name: "Distance" });
    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const workouts = within(screen.getByRole("region", { name: "Workouts" }));
    expect(await within(workouts.getByText("Weekly mileage").parentElement!).findByText("13.10 mi")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/workouts/workout-2", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer session-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ distance: 8 }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("keeps a successful mutation when the follow-up refresh fails", async () => {
    const emptyWeek = {
      week_start: "2026-09-14",
      planned_distance: 0,
      actual_distance: 0,
      workouts: [],
    };
    const createdWorkout = {
      ...weekResponse.workouts[1],
      id: "workout-new",
      date: "2026-09-17",
      title: "Steady Run",
      planned_distance: 4,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => emptyWeek })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => trendResponse })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => createdWorkout })
      .mockRejectedValue(new Error("refresh failed"));
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Thursday, Sep 17" }));
    fireEvent.click(screen.getByRole("button", { name: "Add workout for Sep 17" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Steady Run" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Distance" }), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("article", { name: "Steady Run on 2026-09-17" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Change saved. Updated trend data could not be loaded.",
    );
    expect(screen.queryByRole("button", { name: "Adding..." })).not.toBeInTheDocument();
  });

  it.each([
    ["2026-09-21T03:59:59Z", "2026-09-14", "2026-09-20"],
    ["2026-09-21T04:00:00Z", "2026-09-21", "2026-09-27"],
  ])("requests the current local week and anchors the trend to its Sunday at %s", async (now, weekStart, trendEnd) => {
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
      await screen.findByRole("heading", { name: "Workouts" }),
    ).toBeInTheDocument();
    const options = { headers: { Authorization: "Bearer session-token" } };
    expect(fetchMock).toHaveBeenCalledWith(`/api/weeks/${weekStart}`, options);
    expect(fetchMock).toHaveBeenCalledWith(`/api/trends/mileage?end=${trendEnd}&weeks=12`, options);
  });

  it("navigates past and future weeks, preserves the weekday, and returns to the current week", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-23T12:00:00"));
    const currentWeek = {
      week_start: "2026-09-21",
      planned_distance: 4,
      actual_distance: 4,
      workouts: [{ ...weekResponse.workouts[0], id: "current-run", date: "2026-09-23", title: "Current Run", planned_distance: 4, distance: 4 }],
    };
    const previousWeek = {
      week_start: "2026-09-14",
      planned_distance: 6,
      actual_distance: 0,
      workouts: [{ ...weekResponse.workouts[1], id: "past-run", date: "2026-09-17", title: "Past Run", planned_distance: 6 }],
    };
    const futureWeek = { week_start: "2026-09-28", planned_distance: 0, actual_distance: 0, workouts: [] };
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.includes("trends/mileage")) return { ok: true, status: 200, json: async () => trendResponse };
      const data = url.endsWith("2026-09-14") ? previousWeek : url.endsWith("2026-09-28") ? futureWeek : currentWeek;
      expect(options).toEqual({ headers: { Authorization: "Bearer session-token" } });
      return { ok: true, status: 200, json: async () => data };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Workouts" })).toBeInTheDocument();
    const currentWorkouts = screen.getByRole("region", { name: "Workouts" });
    expect(within(currentWorkouts).getByRole("button", { name: "Previous week" })).toBeInTheDocument();
    expect(within(currentWorkouts).getByRole("button", { name: "Next week" })).toBeInTheDocument();
    expect(screen.getByText("Sep 21–27, 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Wednesday, Sep 23, today" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Select Thursday, Sep 24" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));

    expect(await screen.findByRole("heading", { name: "Thursday, Sep 17, 2026" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Workouts" })).getByRole("button", { name: "Current week" })).toBeInTheDocument();
    expect(screen.getByText("Sep 14–20, 2026")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Past Run on 2026-09-17" })).toBeInTheDocument();
    expect(screen.queryByText("Current Run")).not.toBeInTheDocument();
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/weeks/2026-09-14", { headers: { Authorization: "Bearer session-token" } });

    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(await screen.findByRole("heading", { name: "Thursday, Sep 24, 2026" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(await screen.findByRole("heading", { name: "Thursday, Oct 1, 2026" })).toBeInTheDocument();
    expect(screen.getByText("Sep 28–Oct 4, 2026")).toBeInTheDocument();
    expect(screen.getByText("No workouts yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add workout for Oct 1" })).toBeInTheDocument();
    expect(screen.queryByText("Today")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Current week" }));
    expect(await screen.findByRole("heading", { name: "Thursday, Sep 24, 2026" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Workouts" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Current week" })).not.toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Weekly Mileage Trend" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/weeks/2026-09-28", { headers: { Authorization: "Bearer session-token" } });
    expect(fetchMock).toHaveBeenCalledWith("/api/trends/mileage?end=2026-09-27&weeks=12", { headers: { Authorization: "Bearer session-token" } });
  });

  it("navigates the 12-week trend independently one week at a time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-23T12:00:00"));
    const currentWeek = { week_start: "2026-09-21", planned_distance: 0, actual_distance: 0, workouts: [] };
    const futureWeek = { week_start: "2026-09-28", planned_distance: 0, actual_distance: 0, workouts: [] };
    const trendWindow = (endWeekStart: string) => {
      const [year, month, day] = endWeekStart.split("-").map(Number);
      const end = new Date(Date.UTC(year, month - 1, day));
      return Array.from({ length: 12 }, (_, index) => {
        const week = new Date(end);
        week.setUTCDate(end.getUTCDate() - (11 - index) * 7);
        return { week_start: week.toISOString().slice(0, 10), planned_distance: index, actual_distance: index };
      });
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/trends/mileage")) {
        const end = new URL(url, "https://runner.local").searchParams.get("end");
        const endWeekStart = end === "2026-09-20" ? "2026-09-14" : end === "2026-09-13" ? "2026-09-07" : "2026-09-21";
        return { ok: true, status: 200, json: async () => trendWindow(endWeekStart) };
      }
      return { ok: true, status: 200, json: async () => url.endsWith("2026-09-28") ? futureWeek : currentWeek };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    const trendRegion = await screen.findByRole("region", { name: "Weekly Mileage Trend" });
    const previousTrend = within(trendRegion).getByRole("button", { name: "Previous 12-week trend window" });
    const nextTrend = within(trendRegion).getByRole("button", { name: "Next 12-week trend window" });
    expect(within(trendRegion).getByText("12 weeks · Jul 6–Sep 21, 2026 · miles")).toBeInTheDocument();
    expect(nextTrend).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Select Thursday, Sep 24" }));
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(await screen.findByRole("heading", { name: "Thursday, Oct 1, 2026" })).toBeInTheDocument();
    fireEvent.click(previousTrend);
    expect(await within(trendRegion).findByText("12 weeks · Jun 29–Sep 14, 2026 · miles")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Thursday, Oct 1, 2026" })).toBeInTheDocument();
    expect(nextTrend).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledWith("/api/trends/mileage?end=2026-09-20&weeks=12", { headers: { Authorization: "Bearer session-token" } });

    fireEvent.click(previousTrend);
    expect(await within(trendRegion).findByText("12 weeks · Jun 22–Sep 7, 2026 · miles")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/trends/mileage?end=2026-09-13&weeks=12", { headers: { Authorization: "Bearer session-token" } });
    fireEvent.click(nextTrend);
    expect(await within(trendRegion).findByText("12 weeks · Jun 29–Sep 14, 2026 · miles")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Thursday, Oct 1, 2026" })).toBeInTheDocument();
  });

  it("preserves the chart and workout UI when trend navigation fails", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-23T12:00:00"));
    const initialTrend = Array.from({ length: 12 }, (_, index) => ({
      week_start: new Date(Date.UTC(2026, 6, 6 + index * 7)).toISOString().slice(0, 10),
      planned_distance: index,
      actual_distance: index,
    }));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ...weekResponse, week_start: "2026-09-21", workouts: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => initialTrend })
      .mockRejectedValueOnce(new Error("unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    const trendRegion = await screen.findByRole("region", { name: "Weekly Mileage Trend" });
    fireEvent.click(within(trendRegion).getByRole("button", { name: "Previous 12-week trend window" }));

    expect(await within(trendRegion).findByRole("alert")).toHaveTextContent("Unable to load mileage trend.");
    expect(within(trendRegion).getByText("12 weeks · Jul 6–Sep 21, 2026 · miles")).toBeInTheDocument();
    expect(within(trendRegion).getByRole("img", { name: /Actual weekly mileage/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Wednesday, Sep 23, 2026" })).toBeInTheDocument();
  });

  it("keeps workout content visible while a trend window loads", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-23T12:00:00"));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ...weekResponse, week_start: "2026-09-21", workouts: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => trendResponse })
      .mockImplementationOnce(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    const trendRegion = await screen.findByRole("region", { name: "Weekly Mileage Trend" });
    fireEvent.click(within(trendRegion).getByRole("button", { name: "Previous 12-week trend window" }));

    expect(within(trendRegion).getByRole("status")).toHaveTextContent("Updating mileage trend");
    expect(within(trendRegion).getByRole("status")).toHaveClass("sr-only");
    expect(within(trendRegion).getByRole("button", { name: "Previous 12-week trend window" })).toBeDisabled();
    expect(within(trendRegion).getByRole("img", { name: /Actual weekly mileage/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Wednesday, Sep 23, 2026" })).toBeInTheDocument();
  });

  it("keeps the displayed week intact when navigation fails", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-23T12:00:00"));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ...weekResponse, week_start: "2026-09-21", workouts: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => trendResponse })
      .mockRejectedValueOnce(new Error("unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Previous week" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load selected week.");
    expect(screen.getByText("Sep 21–27, 2026")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Workouts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Wednesday, Sep 23, today" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps create, update, and delete mutations in the selected navigated week", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-23T08:30:00"));
    const currentWeek = { week_start: "2026-09-21", planned_distance: 0, actual_distance: 0, workouts: [] };
    let previousWorkouts: typeof weekResponse.workouts = [];
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/api/workouts") {
        const body = JSON.parse(String(options?.body));
        previousWorkouts = [{ ...weekResponse.workouts[1], ...body, id: "navigated-run" }];
        return { ok: true, status: 201, json: async () => previousWorkouts[0] };
      }
      if (url === "/api/workouts/navigated-run" && options?.method === "PATCH") {
        previousWorkouts = [{ ...previousWorkouts[0], ...JSON.parse(String(options.body)) }];
        return { ok: true, status: 200, json: async () => previousWorkouts[0] };
      }
      if (url === "/api/workouts/navigated-run" && options?.method === "DELETE") {
        previousWorkouts = [];
        return { ok: true, status: 204 };
      }
      if (url.includes("trends/mileage")) return { ok: true, status: 200, json: async () => trendResponse };
      if (url.endsWith("2026-09-14")) return { ok: true, status: 200, json: async () => ({ week_start: "2026-09-14", planned_distance: previousWorkouts.length ? 5 : 0, actual_distance: 0, workouts: previousWorkouts }) };
      return { ok: true, status: 200, json: async () => currentWeek };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Previous week" }));
    expect(await screen.findByText("Sep 14–20, 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select Wednesday, Sep 16" }));
    fireEvent.click(screen.getByRole("button", { name: "Add workout for Sep 16" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Distance" }), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("article", { name: "Workout on 2026-09-16" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Wednesday, Sep 16, 2026" })).toBeInTheDocument();
    expect(screen.getByText("Sep 14–20, 2026")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/workouts", expect.objectContaining({
      body: expect.stringContaining('"date":"2026-09-16"'),
    }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === "/api/weeks/2026-09-14")).toHaveLength(2));

    fireEvent.click(screen.getByRole("button", { name: "Edit Title" }));
    const title = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(title, { target: { value: "Past Tempo" } });
    fireEvent.keyDown(title, { key: "Enter" });
    expect(await screen.findByRole("article", { name: "Past Tempo on 2026-09-16" })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === "/api/weeks/2026-09-14")).toHaveLength(3));

    fireEvent.click(screen.getByRole("button", { name: "Delete Past Tempo" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.queryByRole("article", { name: "Past Tempo on 2026-09-16" })).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Wednesday, Sep 16, 2026" })).toBeInTheDocument();
    expect(screen.getByText("Sep 14–20, 2026")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === "/api/weeks/2026-09-14")).toHaveLength(4));
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
