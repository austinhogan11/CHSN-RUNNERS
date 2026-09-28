import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createExercise,
  getExercises,
  getStrengthMaxes,
  saveStrengthMax,
} from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("strength API", () => {
  it("loads maxes and exercises with the Clerk bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    await getStrengthMaxes("clerk-token");
    await getExercises("clerk-token");

    const options = { headers: { Authorization: "Bearer clerk-token" } };
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/strength/maxes", options);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/strength/exercises", options);
  });

  it("saves a pounds-only max payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "max-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await saveStrengthMax(
      "bench_press",
      { value: 285, effective_date: "2026-09-28" },
      "clerk-token",
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/strength/maxes/bench_press", {
      method: "PUT",
      headers: {
        Authorization: "Bearer clerk-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: 285, effective_date: "2026-09-28" }),
    });
  });

  it("creates a custom exercise without a client-selected ID", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: "server-id" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createExercise(
      {
        name: "Close-Grip Bench Press",
        category: "barbell",
        default_max_source: "bench_press",
      },
      "clerk-token",
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/strength/exercises", {
      method: "POST",
      headers: {
        Authorization: "Bearer clerk-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Close-Grip Bench Press",
        category: "barbell",
        default_max_source: "bench_press",
      }),
    });
  });
});
