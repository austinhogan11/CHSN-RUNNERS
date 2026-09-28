import type {
  Exercise,
  ExerciseCreate,
  StrengthMax,
  StrengthMaxCollection,
  StrengthMaxUpsert,
} from "./types";

const API_BASE = "/api/strength";

export class StrengthApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "StrengthApiError";
    this.status = status;
  }
}

export async function getStrengthMaxes(
  token: string,
): Promise<StrengthMaxCollection> {
  return request<StrengthMaxCollection>("/maxes", token);
}

export async function saveStrengthMax(
  exerciseKey: string,
  payload: StrengthMaxUpsert,
  token: string,
): Promise<StrengthMax> {
  return request<StrengthMax>(`/maxes/${encodeURIComponent(exerciseKey)}`, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getExercises(token: string): Promise<Exercise[]> {
  return request<Exercise[]>("/exercises", token);
}

export async function createExercise(
  payload: ExerciseCreate,
  token: string,
): Promise<Exercise> {
  return request<Exercise>("/exercises", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function strengthErrorMessage(error: unknown, action: string): string {
  if (error instanceof StrengthApiError) {
    if (error.status === 401) {
      return "Your session expired. Sign in and try again.";
    }
    if (error.status === 422) {
      return `Check the ${action} values and try again.`;
    }
  }
  return `Unable to save ${action}. Try again.`;
}

async function request<T>(
  path: string,
  token: string,
  init: Pick<RequestInit, "method" | "body"> = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  if (!response.ok) {
    throw new StrengthApiError("Strength API request failed", response.status);
  }

  return response.json() as Promise<T>;
}
