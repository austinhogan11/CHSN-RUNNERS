import { afterEach, describe, expect, it, vi } from "vitest";

import {
  WorkoutApiError,
  createWorkout,
  deleteWorkout,
  mutationErrorMessage,
  updateWorkout,
} from "./api";

const workoutResponse = {
  id: "workout-1",
  date: "2026-09-14",
  type: "run" as const,
  title: "Easy Run",
  description: null,
  planned_distance: 5,
  start_time: null,
  duration_seconds: null,
  distance: null,
  status: "planned" as const,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("workout mutation API", () => {
  it("creates with JSON and the Clerk bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => workoutResponse,
    });
    vi.stubGlobal("fetch", fetchMock);

    await createWorkout({ date: "2026-09-14", title: "Easy Run" }, "clerk-token");

    expect(fetchMock).toHaveBeenCalledWith("/api/workouts", {
      method: "POST",
      headers: {
        Authorization: "Bearer clerk-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ date: "2026-09-14", title: "Easy Run" }),
    });
  });

  it("patches only the supplied changes with the Clerk bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => workoutResponse,
    });
    vi.stubGlobal("fetch", fetchMock);

    await updateWorkout("workout-1", { title: null }, "clerk-token");

    expect(fetchMock).toHaveBeenCalledWith("/api/workouts/workout-1", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer clerk-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: null }),
    });
  });

  it("deletes with the Clerk bearer token and no request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);

    await deleteWorkout("workout-1", "clerk-token");

    expect(fetchMock).toHaveBeenCalledWith("/api/workouts/workout-1", {
      method: "DELETE",
      headers: { Authorization: "Bearer clerk-token" },
    });
  });

  it.each([
    [401, "Your session expired"],
    [404, "no longer exists"],
    [422, "Check the workout values"],
    [500, "Unable to complete that change"],
  ])("maps status %s to a useful mutation error", (status, message) => {
    expect(mutationErrorMessage(new WorkoutApiError("failed", status))).toContain(message);
  });
});
