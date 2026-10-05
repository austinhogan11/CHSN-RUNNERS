import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createExercise,
  createStrengthSession,
  deleteStrengthSession,
  getExercises,
  getStrengthMaxes,
  getStrengthPrograms,
  getStrengthProgramInstances,
  getStrengthSession,
  getStrengthWeek,
  saveStrengthMax,
  scheduleStrengthProgramDay,
  scheduleStrengthProgram,
  strengthErrorMessage,
  updateStrengthSession,
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

  it("uses authenticated strength week and session routes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getStrengthWeek("2026-09-21", "clerk-token");
    await getStrengthSession("session/1", "clerk-token");

    const options = { headers: { Authorization: "Bearer clerk-token" } };
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/strength/weeks/2026-09-21", options);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/strength/sessions/session%2F1", options);
  });

  it("loads programs and schedules a program day on a selected date", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getStrengthPrograms("clerk-token");
    await scheduleStrengthProgramDay(
      "ppsa/sport",
      4,
      "2026-09-30",
      "clerk-token",
    );

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/strength/programs", {
      headers: { Authorization: "Bearer clerk-token" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/strength/programs/ppsa%2Fsport/days/4/schedule",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer clerk-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date: "2026-09-30" }),
      },
    );
  });

  it("schedules a whole program with one authenticated request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ instance: {}, sessions: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getStrengthProgramInstances("clerk-token");
    await scheduleStrengthProgram(
      "ppsa/sport",
      {
        start_date: "2026-09-30",
        days_per_week: 3,
        selected_weekdays: [0, 2, 4],
      },
      "clerk-token",
    );

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/strength/program-instances", {
      headers: { Authorization: "Bearer clerk-token" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/strength/programs/ppsa%2Fsport/schedule",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer clerk-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start_date: "2026-09-30",
          days_per_week: 3,
          selected_weekdays: [0, 2, 4],
        }),
      },
    );
  });

  it("creates, updates, and deletes a session with explicit JSON payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "session-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const createPayload = {
      date: "2026-09-23",
      title: "Upper Body",
      notes: null,
      exercise_blocks: [],
    };
    const updatePayload = {
      title: "Upper Strength",
      notes: "Build steadily",
      exercise_blocks: [],
    };

    await createStrengthSession(createPayload, "clerk-token");
    await updateStrengthSession("session-1", updatePayload, "clerk-token");
    await deleteStrengthSession("session-1", "clerk-token");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/strength/sessions", {
      method: "POST",
      headers: {
        Authorization: "Bearer clerk-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createPayload),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/strength/sessions/session-1", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer clerk-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/strength/sessions/session-1", {
      method: "DELETE",
      headers: { Authorization: "Bearer clerk-token" },
    });
  });

  it("preserves useful FastAPI validation detail", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        detail: [
          {
            loc: ["body", "exercise_blocks", 0, "planned_sets", 0],
            msg: "Value error, percentage and max source must be provided together",
            type: "value_error",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    let message = "";
    try {
      await updateStrengthSession("session-1", { exercise_blocks: [] }, "clerk-token");
    } catch (error) {
      message = strengthErrorMessage(error, "strength session");
    }

    expect(message).toBe(
      "Value error, percentage and max source must be provided together",
    );
  });
});
