import type {
  MileageTrendPoint,
  WeekSummary,
  Workout,
  WorkoutCreate,
  WorkoutUpdate,
} from "./types";

const API_BASE = "/api";

function authorizationHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function mutationHeaders(token: string): HeadersInit {
  return {
    ...authorizationHeaders(token),
    "Content-Type": "application/json",
  };
}

export class WorkoutApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "WorkoutApiError";
    this.status = status;
  }
}

export async function getWeek(date: string, token: string): Promise<WeekSummary> {
  const response = await fetch(`${API_BASE}/weeks/${date}`, {
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Failed to load week: ${response.status}`);
  }

  return response.json() as Promise<WeekSummary>;
}

export async function getMileageTrend(
  end: string,
  token: string,
  weeks = 12,
): Promise<MileageTrendPoint[]> {
  const params = new URLSearchParams({
    end,
    weeks: String(weeks),
  });

  const response = await fetch(`${API_BASE}/trends/mileage?${params}`, {
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Failed to load mileage trend: ${response.status}`);
  }

  return response.json() as Promise<MileageTrendPoint[]>;
}

export async function createWorkout(
  workout: WorkoutCreate,
  token: string,
): Promise<Workout> {
  return requestWorkout("/workouts", token, {
    method: "POST",
    body: JSON.stringify(workout),
  });
}

export async function updateWorkout(
  workoutId: string,
  changes: WorkoutUpdate,
  token: string,
): Promise<Workout> {
  return requestWorkout(`/workouts/${workoutId}`, token, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

export async function deleteWorkout(
  workoutId: string,
  token: string,
): Promise<void> {
  const response = await fetch(`${API_BASE}/workouts/${workoutId}`, {
    method: "DELETE",
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new WorkoutApiError("Failed to delete workout", response.status);
  }
}

export function mutationErrorMessage(error: unknown): string {
  if (error instanceof WorkoutApiError) {
    if (error.status === 401) {
      return "Your session expired. Sign in and try again.";
    }
    if (error.status === 404) {
      return "This session no longer exists. Refresh and try again.";
    }
    if (error.status === 422) {
      return "Check the workout values and try again.";
    }
  }

  return "Unable to complete that change. Try again.";
}

async function requestWorkout(
  path: string,
  token: string,
  init: Pick<RequestInit, "method" | "body">,
): Promise<Workout> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: mutationHeaders(token),
  });

  if (!response.ok) {
    throw new WorkoutApiError("Failed to save workout", response.status);
  }

  return response.json() as Promise<Workout>;
}
