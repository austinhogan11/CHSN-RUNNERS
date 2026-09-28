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

  it("renders maxes and expands or collapses the exercise library disclosure", async () => {
    vi.stubGlobal("fetch", strengthFetch());

    render(<StrengthPage />);

    const maxesRegion = await screen.findByRole("region", { name: "Maxes" });
    const benchCard = within(maxesRegion)
      .getByRole("heading", { name: "Bench Press" })
      .closest("article");
    expect(within(benchCard!).getByRole("button", { name: "265 lb" })).toBeInTheDocument();
    expect(within(maxesRegion).getAllByRole("button", { name: "Add max" })).toHaveLength(6);
    expect(within(maxesRegion).queryByText(/kg/i)).not.toBeInTheDocument();

    fireEvent.click(within(maxesRegion).getByText("History"));
    expect(within(maxesRegion).getByText("Sep 1, 2026")).toBeInTheDocument();
    expect(within(maxesRegion).getByText("Aug 1, 2026")).toBeInTheDocument();
    expect(within(maxesRegion).getByText("255 lb")).toBeInTheDocument();

    const library = screen.getByRole("region", { name: "Exercise Library" });
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

  it("saves a max, refetches authoritative data, and retains history", async () => {
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
      if (url === "/api/strength/exercises") return response(exercises);
      if (url === "/api/strength/maxes/bench_press") return response(refreshed.current[0]);
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StrengthPage />);

    const benchCard = (await screen.findByRole("heading", { name: "Bench Press" })).closest("article")!;
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
    fireEvent.click(within(benchCard).getByText("History"));
    expect(within(benchCard).getByText("265 lb")).toBeInTheDocument();
  });

  it("cancels an inline max edit with Escape", async () => {
    vi.stubGlobal("fetch", strengthFetch());

    render(<StrengthPage />);

    const benchCard = (await screen.findByRole("heading", { name: "Bench Press" })).closest("article")!;
    fireEvent.click(within(benchCard).getByRole("button", { name: "265 lb" }));
    const input = within(benchCard).getByRole("spinbutton", { name: "Bench Press max" });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "300" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(within(benchCard).queryByRole("spinbutton", { name: "Bench Press max" })).not.toBeInTheDocument();
    expect(within(benchCard).getByRole("button", { name: "265 lb" })).toBeInTheDocument();
  });

  it("rejects a non-positive max before calling the API", async () => {
    const fetchMock = strengthFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(<StrengthPage />);

    const benchCard = (await screen.findByRole("heading", { name: "Bench Press" })).closest("article")!;
    fireEvent.click(within(benchCard).getByRole("button", { name: "265 lb" }));
    const input = within(benchCard).getByRole("spinbutton", { name: "Bench Press max" });
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await within(benchCard).findByRole("alert")).toHaveTextContent(
      "Enter a max greater than 0 pounds.",
    );
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
      if (url === "/api/strength/maxes") return response(maxes);
      if (url === "/api/strength/exercises") return response(exercises);
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StrengthPage />);

    const benchCard = (await screen.findByRole("heading", { name: "Bench Press" })).closest("article")!;
    fireEvent.click(within(benchCard).getByRole("button", { name: "265 lb" }));
    fireEvent.click(within(benchCard).getByRole("button", { name: "Save" }));

    expect(await within(benchCard).findByRole("alert")).toHaveTextContent("Unable to save max");
    fireEvent.click(within(benchCard).getByRole("button", { name: "Cancel" }));
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

function strengthFetch() {
  return vi.fn(async (url: string) => {
    if (url === "/api/strength/maxes") return response(maxes);
    if (url === "/api/strength/exercises") return response(exercises);
    throw new Error(`Unexpected URL: ${url}`);
  });
}

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}
