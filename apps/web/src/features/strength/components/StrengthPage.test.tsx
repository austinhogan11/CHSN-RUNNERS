import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StrengthPage } from "./StrengthPage";

const clerk = vi.hoisted(() => ({
  getToken: vi.fn(() => Promise.resolve<string | null>("session-token")),
}));

vi.mock("@clerk/react", () => ({
  useAuth: () => ({ getToken: clerk.getToken }),
}));

const maxes = {
  current: [
    {
      id: "bench-current",
      exercise_key: "bench_press",
      value: 265,
      effective_date: "2026-09-01",
      created_at: "2026-09-01T12:00:00Z",
    },
  ],
  history: [
    {
      id: "bench-old",
      exercise_key: "bench_press",
      value: 255,
      effective_date: "2026-08-01",
      created_at: "2026-08-01T12:00:00Z",
    },
    {
      id: "bench-current",
      exercise_key: "bench_press",
      value: 265,
      effective_date: "2026-09-01",
      created_at: "2026-09-01T12:00:00Z",
    },
  ],
};

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
    id: "custom-landmine",
    name: "Landmine Press",
    category: "landmine",
    default_max_source: "overhead_press",
    is_custom: true,
  },
];

const emptyWeek = {
  week_start: "2026-09-28",
  week_end: "2026-10-04",
  sessions: [],
};

afterEach(() => {
  clerk.getToken.mockReset();
  clerk.getToken.mockResolvedValue("session-token");
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("StrengthPage", () => {
  it("shows a loading state while strength data is fetched", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    render(<StrengthPage />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading strength...");
  });

  it("loads Strength weeks with shared navigation while preserving the selected weekday", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T12:00:00"));
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/strength/maxes") return response(maxes);
      if (url === "/api/strength/exercises") return response(exercises);
      if (url === "/api/strength/programs") return response([]);
      if (url === "/api/strength/program-instances") return response([]);
      if (url === "/api/strength/weeks/2026-09-28") return response(emptyWeek);
      if (url === "/api/strength/weeks/2026-09-21") {
        return response({ week_start: "2026-09-21", week_end: "2026-09-27", sessions: [] });
      }
      if (url === "/api/strength/weeks/2026-10-05") throw new Error("week failed");
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StrengthPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Select Thursday, Oct 1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    expect(await screen.findByRole("button", { name: /Select Thursday, Sep 24/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(await screen.findByRole("button", { name: /Select Thursday, Oct 1/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load selected strength week.",
    );
    expect(screen.getByRole("button", { name: /Select Thursday, Oct 1/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("renders maxes and expands or collapses the exercise library disclosure", async () => {
    vi.stubGlobal("fetch", strengthFetch());

    render(<StrengthPage />);

    const maxesRegion = await screen.findByRole("region", { name: "Maxes" });
    const library = screen.getByRole("region", { name: "Exercise Library" });
    const weeklyTraining = screen.getByRole("region", { name: "Weekly Training" });
    expect(maxesRegion.compareDocumentPosition(library) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(library.compareDocumentPosition(weeklyTraining) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("Pounds")).not.toBeInTheDocument();
    const maxesDisclosure = within(maxesRegion).getByRole("button", { name: "Maxes" });
    expect(maxesDisclosure).toHaveAttribute("aria-expanded", "false");
    const bigThree = within(maxesRegion).getByLabelText("Big 3 maxes");
    expect(within(bigThree).getByText("Bench Press")).toBeInTheDocument();
    expect(within(bigThree).getByText("Back Squat")).toBeInTheDocument();
    expect(within(bigThree).getByText("Deadlift")).toBeInTheDocument();
    expect(within(bigThree).getByText("265 lb")).toBeInTheDocument();
    expect(within(bigThree).getAllByText("—")).toHaveLength(2);
    expect(within(maxesRegion).queryByRole("group", { name: "Bench Press max history" })).not.toBeInTheDocument();

    fireEvent.click(maxesDisclosure);

    expect(maxesDisclosure).toHaveAttribute("aria-expanded", "true");
    const benchSelect = within(maxesRegion).getByRole("button", { name: "Bench Press" });
    const benchCard = benchSelect.closest("article")!;
    expect(benchSelect).toHaveAttribute("aria-pressed", "true");
    expect(within(benchCard).getByRole("button", { name: "265 lb" })).toBeInTheDocument();
    expect(within(maxesRegion).getAllByRole("button", { name: "Add max" })).toHaveLength(6);
    expect(within(maxesRegion).queryByText(/kg/i)).not.toBeInTheDocument();
    expect(within(maxesRegion).queryByText("History")).not.toBeInTheDocument();
    expect(within(maxesRegion).getByRole("group", { name: "Bench Press max history" })).toBeInTheDocument();
    expect(within(maxesRegion).getByRole("button", { name: "Year to date" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(maxesDisclosure);
    expect(maxesDisclosure).toHaveAttribute("aria-expanded", "false");
    expect(within(maxesRegion).queryByRole("group", { name: "Bench Press max history" })).not.toBeInTheDocument();

    const disclosure = within(library).getByRole("button", {
      name: "Exercise Library, 3 exercises",
    });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(within(library).queryByRole("searchbox", { name: "Search exercises" })).not.toBeInTheDocument();

    fireEvent.click(disclosure);

    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(within(library).getByText("Farmers Walk")).toBeInTheDocument();
    expect(within(library).getByText("Landmine Press")).toBeInTheDocument();
    expect(within(library).getAllByText("Built-in")).toHaveLength(2);
    expect(within(library).getByText("Custom")).toBeInTheDocument();

    fireEvent.click(disclosure);

    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(within(library).queryByText("Farmers Walk")).not.toBeInTheDocument();
  });

  it("selects one shared max chart and uses true YTD, 1Y, or All calendar domains", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T12:00:00"));
    const historyMaxes = {
      current: [
        maxes.current[0],
        { ...maxes.current[0], id: "deadlift-current", exercise_key: "deadlift", value: 350 },
      ],
      history: [
        { ...maxes.history[0], id: "bench-newest", value: 265, effective_date: "2026-09-01" },
        { ...maxes.history[0], id: "deadlift-only", exercise_key: "deadlift", value: 350, effective_date: "2026-09-28" },
        { ...maxes.history[0], id: "bench-oldest", value: 200, effective_date: "2025-01-01" },
        { ...maxes.history[0], id: "bench-recent", value: 250, effective_date: "2026-07-10" },
        { ...maxes.history[0], id: "bench-year", value: 220, effective_date: "2025-10-01" },
        { ...maxes.history[0], id: "bench-summer", value: 240, effective_date: "2026-06-01" },
      ],
    };
    vi.stubGlobal("fetch", strengthFetch(historyMaxes));

    render(<StrengthPage />);

    const maxesRegion = await screen.findByRole("region", { name: "Maxes" });
    fireEvent.click(within(maxesRegion).getByRole("button", { name: "Maxes" }));
    const benchChart = within(maxesRegion).getByRole("group", { name: "Bench Press max history" });
    expect(benchChart).toHaveAttribute("data-domain-start", "2026-01-01");
    expect(benchChart).toHaveAttribute("data-domain-end", "2026-09-29");
    expect(within(benchChart).getAllByRole("img").map((point) => point.getAttribute("aria-label"))).toEqual([
      "Jun 1: 240 pounds",
      "Jul 10: 250 pounds",
      "Sep 1: 265 pounds",
    ]);
    fireEvent.focus(within(benchChart).getByRole("img", { name: "Jul 10: 250 pounds" }));
    expect(within(benchChart).getByRole("tooltip", { name: "Jul 10, 250 lb" })).toBeInTheDocument();
    fireEvent.blur(within(benchChart).getByRole("img", { name: "Jul 10: 250 pounds" }));

    fireEvent.click(within(maxesRegion).getByRole("button", { name: "Trailing year" }));
    expect(benchChart).toHaveAttribute("data-domain-start", "2025-09-29");
    expect(benchChart).toHaveAttribute("data-domain-end", "2026-09-29");
    expect(within(benchChart).getAllByRole("img").map((point) => point.getAttribute("aria-label"))).toEqual([
      "Oct 1: 220 pounds",
      "Jun 1: 240 pounds",
      "Jul 10: 250 pounds",
      "Sep 1: 265 pounds",
    ]);

    fireEvent.click(within(maxesRegion).getByRole("button", { name: "All history" }));
    expect(benchChart).toHaveAttribute("data-domain-start", "2025-01-01");
    expect(benchChart).toHaveAttribute("data-domain-end", "2026-09-29");
    expect(within(benchChart).getAllByRole("img").map((point) => point.getAttribute("aria-label"))).toEqual([
      "Jan 1: 200 pounds",
      "Oct 1: 220 pounds",
      "Jun 1: 240 pounds",
      "Jul 10: 250 pounds",
      "Sep 1: 265 pounds",
    ]);

    fireEvent.click(within(maxesRegion).getByRole("button", { name: "Deadlift" }));
    const deadliftChart = within(maxesRegion).getByRole("group", { name: "Deadlift max history" });
    expect(within(deadliftChart).getAllByRole("img")).toHaveLength(1);
    const recentPoint = within(deadliftChart).getByRole("img", { name: "Sep 28: 350 pounds" });
    expect(recentPoint).toBeInTheDocument();
    expect(deadliftChart).toHaveAttribute("data-domain-start", "2026-01-01");
    expect(deadliftChart).toHaveAttribute("data-domain-end", "2026-09-29");
    expect(Number(recentPoint.querySelector(".chart-dot")?.getAttribute("cx"))).toBeGreaterThan(900);
    expect(deadliftChart.querySelector(".chart-line")).toHaveAttribute(
      "points",
      expect.stringMatching(/^44,164 /),
    );
    expect(deadliftChart.querySelector("polygon")).toHaveAttribute("fill", expect.stringMatching(/^url\(/));
    expect(within(maxesRegion).queryByRole("img", { name: /265 pounds/ })).not.toBeInTheDocument();

    fireEvent.click(within(maxesRegion).getByRole("button", { name: "265 lb" }));
    expect(within(maxesRegion).getByRole("spinbutton", { name: "Bench Press max" })).toBeInTheDocument();
    expect(within(maxesRegion).getByRole("group", { name: "Deadlift max history" })).toBeInTheDocument();
    fireEvent.keyDown(within(maxesRegion).getByRole("spinbutton", { name: "Bench Press max" }), { key: "Escape" });

    fireEvent.click(within(maxesRegion).getByRole("button", { name: "Back Squat" }));
    expect(within(maxesRegion).getByText("No max history in this range.")).toBeInTheDocument();
    expect(within(maxesRegion).queryByRole("group", { name: "Back Squat max history" })).not.toBeInTheDocument();
  });

  it("creates and deletes a same-day session through authoritative week refreshes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-23T12:00:00"));
    const existingSession = {
      id: "session-1",
      date: "2026-09-23",
      title: "Upper Body",
      notes: null,
      exercise_blocks: [],
    };
    const secondSession = { ...existingSession, id: "session-2", title: "Accessories" };
    const createdSession = { ...existingSession, id: "session-3", title: "Strength Session" };
    let weekGetCount = 0;
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/api/strength/maxes") return response(maxes);
      if (url === "/api/strength/exercises") return response(exercises);
      if (url === "/api/strength/programs") return response([]);
      if (url === "/api/strength/program-instances") return response([]);
      if (url.startsWith("/api/strength/weeks/")) {
        weekGetCount += 1;
        return response({
          week_start: "2026-09-21",
          week_end: "2026-09-27",
          sessions: weekGetCount === 2
            ? [existingSession, secondSession, createdSession]
            : [existingSession, secondSession],
        });
      }
      if (url === "/api/strength/sessions" && options?.method === "POST") {
        return response(createdSession, 201);
      }
      if (url === "/api/strength/sessions/session-3" && options?.method === "DELETE") {
        return response({}, 204);
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StrengthPage />);

    fireEvent.click(await screen.findByRole("button", { name: "+ Blank workout" }));

    const sessionSelector = within(await screen.findByLabelText("Strength sessions"));
    expect(sessionSelector.getByRole("button", { name: /Strength Session/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/strength/sessions",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: "2026-09-23",
          title: "Strength Session",
          notes: null,
          exercise_blocks: [],
        }),
      },
    );
    expect(weekGetCount).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "Delete session" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(weekGetCount).toBe(3));
    expect(sessionSelector.queryByRole("button", { name: /Strength Session/ })).not.toBeInTheDocument();
    expect(sessionSelector.getByRole("button", { name: /Upper Body/ })).toBeInTheDocument();
    expect(sessionSelector.getByRole("button", { name: /Accessories/ })).toBeInTheDocument();
  });

  it("saves a max with Enter, refetches authoritative data, and refreshes the chart", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T12:00:00"));
    const refreshed = {
      current: [{ ...maxes.current[0], id: "bench-new", value: 285, effective_date: "2026-09-28" }],
      history: [
        ...maxes.history,
        { ...maxes.current[0], id: "bench-new", value: 285, effective_date: "2026-09-28" },
      ],
    };
    let maxGetCount = 0;
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/api/strength/maxes" && !options?.method) {
        maxGetCount += 1;
        return response(maxGetCount === 1 ? maxes : refreshed);
      }
      if (url === "/api/strength/programs") return response([]);
      if (url === "/api/strength/program-instances") return response([]);
      if (url.startsWith("/api/strength/weeks/")) return response(emptyWeek);
      if (url === "/api/strength/exercises") return response(exercises);
      if (url === "/api/strength/maxes/bench_press") return response(refreshed.current[0]);
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StrengthPage />);

    const benchCard = await findMaxCard("Bench Press");
    fireEvent.click(within(benchCard).getByRole("button", { name: "265 lb" }));
    fireEvent.change(within(benchCard).getByRole("spinbutton", { name: "Bench Press max" }), {
      target: { value: "285" },
    });
    fireEvent.keyDown(within(benchCard).getByRole("spinbutton", { name: "Bench Press max" }), {
      key: "Enter",
    });

    await waitFor(() => {
      expect(within(benchCard).getByRole("button", { name: "285 lb" })).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/strength/maxes/bench_press", {
      method: "PUT",
      headers: {
        Authorization: "Bearer session-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: 285, effective_date: "2026-09-28" }),
    });
    const chart = screen.getByRole("group", { name: "Bench Press max history" });
    expect(within(chart).getByRole("img", { name: "Sep 28: 285 pounds" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Date" })).not.toBeInTheDocument();
  });

  it("saves a valid max on blur", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T12:00:00"));
    const refreshed = {
      current: [{ ...maxes.current[0], id: "bench-blur", value: 275, effective_date: "2026-09-28" }],
      history: [
        ...maxes.history,
        { ...maxes.current[0], id: "bench-blur", value: 275, effective_date: "2026-09-28" },
      ],
    };
    let maxGetCount = 0;
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/api/strength/maxes" && !options?.method) {
        maxGetCount += 1;
        return response(maxGetCount === 1 ? maxes : refreshed);
      }
      if (url === "/api/strength/programs") return response([]);
      if (url === "/api/strength/program-instances") return response([]);
      if (url.startsWith("/api/strength/weeks/")) return response(emptyWeek);
      if (url === "/api/strength/exercises") return response(exercises);
      if (url === "/api/strength/maxes/bench_press") return response(refreshed.current[0]);
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StrengthPage />);

    const benchCard = await findMaxCard("Bench Press");
    fireEvent.click(within(benchCard).getByRole("button", { name: "265 lb" }));
    const input = within(benchCard).getByRole("spinbutton", { name: "Bench Press max" });
    fireEvent.change(input, { target: { value: "275" } });
    fireEvent.blur(input);

    expect(await within(benchCard).findByRole("button", { name: "275 lb" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/strength/maxes/bench_press",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("cancels an inline max edit with Escape", async () => {
    vi.stubGlobal("fetch", strengthFetch());

    render(<StrengthPage />);

    const benchCard = await findMaxCard("Bench Press");
    fireEvent.click(within(benchCard).getByRole("button", { name: "265 lb" }));
    const input = within(benchCard).getByRole("spinbutton", { name: "Bench Press max" });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "300" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(within(benchCard).queryByRole("spinbutton", { name: "Bench Press max" })).not.toBeInTheDocument();
    expect(within(benchCard).getByRole("button", { name: "265 lb" })).toBeInTheDocument();
  });

  it("reverts an invalid max on blur without calling the API", async () => {
    const fetchMock = strengthFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(<StrengthPage />);

    const benchCard = await findMaxCard("Bench Press");
    fireEvent.click(within(benchCard).getByRole("button", { name: "265 lb" }));
    const input = within(benchCard).getByRole("spinbutton", { name: "Bench Press max" });
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);

    expect(await within(benchCard).findByRole("alert")).toHaveTextContent(
      "Enter a max greater than 0 lb.",
    );
    expect(within(benchCard).getByRole("button", { name: "265 lb" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/strength/maxes/bench_press",
      expect.anything(),
    );
  });

  it("shows max save errors without replacing current data", async () => {
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/api/strength/maxes/bench_press" && options?.method === "PUT") {
        return response({}, 500);
      }
      if (url === "/api/strength/programs") return response([]);
      if (url === "/api/strength/program-instances") return response([]);
      if (url.startsWith("/api/strength/weeks/")) return response(emptyWeek);
      if (url === "/api/strength/maxes") return response(maxes);
      if (url === "/api/strength/exercises") return response(exercises);
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StrengthPage />);

    const benchCard = await findMaxCard("Bench Press");
    fireEvent.click(within(benchCard).getByRole("button", { name: "265 lb" }));
    const input = within(benchCard).getByRole("spinbutton", { name: "Bench Press max" });
    fireEvent.change(input, { target: { value: "275" } });
    fireEvent.blur(input);

    expect(await within(benchCard).findByRole("alert")).toHaveTextContent("Unable to save max");
    expect(within(benchCard).getByRole("button", { name: "265 lb" })).toBeInTheDocument();
  });

  it("filters by name and creates a custom exercise with a backend refresh", async () => {
    const custom = {
      id: "custom-close-grip",
      name: "Close-Grip Bench Press",
      category: "barbell",
      default_max_source: "bench_press",
      is_custom: true,
    };
    let exerciseGetCount = 0;
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/api/strength/exercises" && options?.method === "POST") return response(custom, 201);
      if (url === "/api/strength/programs") return response([]);
      if (url === "/api/strength/program-instances") return response([]);
      if (url.startsWith("/api/strength/weeks/")) return response(emptyWeek);
      if (url === "/api/strength/maxes") return response(maxes);
      if (url === "/api/strength/exercises") {
        exerciseGetCount += 1;
        return response(exerciseGetCount === 1 ? exercises : [...exercises, custom]);
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StrengthPage />);

    const library = await screen.findByRole("region", { name: "Exercise Library" });
    fireEvent.click(within(library).getByRole("button", { name: "Exercise Library, 3 exercises" }));
    const search = within(library).getByRole("searchbox", { name: "Search exercises" });
    fireEvent.change(search, { target: { value: "bench" } });
    expect(within(library).getByText("Bench Press", { selector: "strong" })).toBeInTheDocument();
    expect(within(library).queryByText("Farmers Walk")).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "" } });

    fireEvent.click(within(library).getByRole("button", { name: "Add Exercise" }));
    fireEvent.change(within(library).getByRole("textbox", { name: "Exercise name" }), {
      target: { value: "Close-Grip Bench Press" },
    });
    fireEvent.change(within(library).getByRole("textbox", { name: "Category" }), {
      target: { value: "barbell" },
    });
    fireEvent.change(within(library).getByRole("combobox", { name: "Default max source" }), {
      target: { value: "bench_press" },
    });
    fireEvent.click(within(library).getByRole("button", { name: "Add exercise" }));

    expect(await within(library).findByText("Close-Grip Bench Press")).toBeInTheDocument();
    expect(within(library).getByText("4 exercises")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/strength/exercises", {
      method: "POST",
      headers: {
        Authorization: "Bearer session-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Close-Grip Bench Press",
        category: "barbell",
        default_max_source: "bench_press",
      }),
    });
  });

  it("shows custom exercise API errors without adding the exercise", async () => {
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/api/strength/maxes") return response(maxes);
      if (url === "/api/strength/programs") return response([]);
      if (url === "/api/strength/program-instances") return response([]);
      if (url.startsWith("/api/strength/weeks/")) return response(emptyWeek);
      if (url === "/api/strength/exercises" && options?.method === "POST") return response({}, 500);
      if (url === "/api/strength/exercises") return response(exercises);
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StrengthPage />);

    const library = await screen.findByRole("region", { name: "Exercise Library" });
    fireEvent.click(within(library).getByRole("button", { name: "Exercise Library, 3 exercises" }));
    fireEvent.click(within(library).getByRole("button", { name: "Add Exercise" }));
    fireEvent.change(within(library).getByRole("textbox", { name: "Exercise name" }), {
      target: { value: "Close-Grip Bench Press" },
    });
    fireEvent.change(within(library).getByRole("textbox", { name: "Category" }), {
      target: { value: "barbell" },
    });
    fireEvent.click(within(library).getByRole("button", { name: "Add exercise" }));

    expect(await within(library).findByRole("alert")).toHaveTextContent("Unable to save exercise");
    expect(within(library).queryByText("Close-Grip Bench Press")).not.toBeInTheDocument();
  });
});

function strengthFetch(maxData = maxes) {
  return vi.fn(async (url: string) => {
    if (url === "/api/strength/maxes") return response(maxData);
    if (url === "/api/strength/exercises") return response(exercises);
    if (url === "/api/strength/programs") return response([]);
      if (url === "/api/strength/program-instances") return response([]);
    if (url.startsWith("/api/strength/weeks/")) return response(emptyWeek);
    throw new Error(`Unexpected URL: ${url}`);
  });
}

async function findMaxCard(name: string): Promise<HTMLElement> {
  const maxesRegion = await screen.findByRole("region", { name: "Maxes" });
  const disclosure = within(maxesRegion).getByRole("button", { name: "Maxes" });
  if (disclosure.getAttribute("aria-expanded") === "false") fireEvent.click(disclosure);
  const selector = await screen.findByRole("button", { name });
  return selector.closest("article")!;
}

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}
