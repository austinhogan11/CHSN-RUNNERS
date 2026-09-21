import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
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

    expect(
      screen.getByText("This Week"),
    ).toBeInTheDocument();

    const run = within(screen.getByRole("article", { name: "Easy Run on 2026-09-14" }));
    for (const value of ["Easy Run", "Keep it relaxed", "5.00 mi", "5.10 mi", "41:00", "8:02 /mi"]) {
      expect(run.getByText(value)).toBeInTheDocument();
    }
    expect(run.queryByRole("combobox", { name: "Edit Status" })).not.toBeInTheDocument();
    expect(run.queryByText("Completed")).not.toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Sep 14")).toBeInTheDocument();
    const plannedRun = within(screen.getByRole("article", { name: "Workout on 2026-09-15" }));
    expect(plannedRun.getByRole("button", { name: "Edit Planned miles" })).toHaveTextContent("7.00 mi");
    expect(plannedRun.queryByRole("combobox", { name: "Edit Status" })).not.toBeInTheDocument();
    expect(plannedRun.getAllByText("—")).toHaveLength(4);
    expect(screen.getAllByRole("article")).toHaveLength(7);
    expect(screen.getAllByRole("heading", { name: "Rest" })).toHaveLength(5);

    const summary = within(screen.getByRole("region", { name: "This Week" }));
    expect(summary.getByText("30.00 mi")).toBeInTheDocument();
    expect(summary.getByText("5.10 mi")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Planned and actual weekly mileage/ })).toBeInTheDocument();
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

  it("creates a session and refreshes the week totals and trend", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: /Add session on 2026-09-16/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Tempo Run" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Planned miles" }), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("article", { name: "Tempo Run on 2026-09-16" })).toBeInTheDocument();
    const summary = within(screen.getByRole("region", { name: "This Week" }));
    expect(summary.getByText("6.00 mi")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/workouts", {
      method: "POST",
      headers: {
        Authorization: "Bearer session-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: "2026-09-16",
        title: "Tempo Run",
        planned_distance: 6,
      }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("counts actual data immediately and refreshes week and trend without a status edit", async () => {
    const updatedWorkout = {
      ...weekResponse.workouts[1],
      distance: 7,
      status: "completed",
    };
    const refreshedWeek = {
      ...weekResponse,
      actual_distance: 12.1,
      workouts: [weekResponse.workouts[0], updatedWorkout],
    };
    const refreshedTrend = trendResponse.map((point) => (
      point.week_start === "2026-09-14"
        ? { ...point, actual_distance: 12.1 }
        : point
    ));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => weekResponse })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => trendResponse })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => updatedWorkout })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => refreshedWeek })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => refreshedTrend });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const row = within(await screen.findByRole("article", { name: "Workout on 2026-09-15" }));
    fireEvent.click(row.getByRole("button", { name: "Edit Actual miles" }));
    const input = row.getByRole("spinbutton", { name: "Actual miles" });
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const summary = within(screen.getByRole("region", { name: "This Week" }));
    expect(await summary.findByText("12.10 mi")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/workouts/workout-2", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer session-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ distance: 7 }),
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

    fireEvent.click(await screen.findByRole("button", { name: "Add session on 2026-09-17" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Steady Run" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Planned miles" }), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("article", { name: "Steady Run on 2026-09-17" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Change saved. Updated trend data could not be loaded.",
    );
    expect(screen.queryByRole("button", { name: "Adding..." })).not.toBeInTheDocument();
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
    const options = { headers: { Authorization: "Bearer session-token" } };
    expect(fetchMock).toHaveBeenCalledWith(`/api/weeks/${day}`, options);
    expect(fetchMock).toHaveBeenCalledWith(`/api/trends/mileage?end=${day}&weeks=12`, options);
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
