import type {
  Exercise,
  ExerciseCreate,
  StrengthMax,
  StrengthMaxCollection,
  StrengthMaxUpsert,
  StrengthProgram,
  StrengthProgramInstanceSummary,
  StrengthProgramSchedule,
  StrengthProgramScheduleResult,
  StrengthSession,
  StrengthSessionCreate,
  StrengthSessionUpdate,
  StrengthWeek,
} from "./types";

const API_BASE = "/api/strength";

export class StrengthApiError extends Error {
  readonly status: number;
  readonly detail: string | null;

  constructor(message: string, status: number, detail: string | null = null) {
    super(message);
    this.name = "StrengthApiError";
    this.status = status;
    this.detail = detail;
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

export async function getStrengthWeek(day: string, token: string): Promise<StrengthWeek> {
  return request<StrengthWeek>(`/weeks/${encodeURIComponent(day)}`, token);
}

export async function getStrengthSession(
  sessionId: string,
  token: string,
): Promise<StrengthSession> {
  return request<StrengthSession>(`/sessions/${encodeURIComponent(sessionId)}`, token);
}

export async function getStrengthPrograms(token: string): Promise<StrengthProgram[]> {
  return request<StrengthProgram[]>("/programs", token);
}

export async function getStrengthProgramInstances(
  token: string,
): Promise<StrengthProgramInstanceSummary[]> {
  return request<StrengthProgramInstanceSummary[]>("/program-instances", token);
}

export async function scheduleStrengthProgram(
  programId: string,
  payload: StrengthProgramSchedule,
  token: string,
): Promise<StrengthProgramScheduleResult> {
  return request<StrengthProgramScheduleResult>(
    `/programs/${encodeURIComponent(programId)}/schedule`,
    token,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function scheduleStrengthProgramDay(
  programId: string,
  dayNumber: number,
  date: string,
  token: string,
): Promise<StrengthSession> {
  return request<StrengthSession>(
    `/programs/${encodeURIComponent(programId)}/days/${dayNumber}/schedule`,
    token,
    { method: "POST", body: JSON.stringify({ date }) },
  );
}

export async function createStrengthSession(
  payload: StrengthSessionCreate,
  token: string,
): Promise<StrengthSession> {
  return request<StrengthSession>("/sessions", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStrengthSession(
  sessionId: string,
  payload: StrengthSessionUpdate,
  token: string,
): Promise<StrengthSession> {
  return request<StrengthSession>(`/sessions/${encodeURIComponent(sessionId)}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteStrengthSession(
  sessionId: string,
  token: string,
): Promise<void> {
  const response = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new StrengthApiError("Strength API request failed", response.status);
  }
}

export function strengthErrorMessage(error: unknown, action: string): string {
  if (error instanceof StrengthApiError) {
    if (error.status === 401) {
      return "Your session expired. Sign in and try again.";
    }
    if (error.status === 422) {
      return error.detail ?? `Check the ${action} values and try again.`;
    }
    if (error.status === 409) return error.detail ?? `Unable to save ${action}.`;
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
    throw new StrengthApiError(
      "Strength API request failed",
      response.status,
      await responseErrorDetail(response),
    );
  }

  return response.json() as Promise<T>;
}

async function responseErrorDetail(response: Response): Promise<string | null> {
  try {
    const body = await response.json() as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      const messages = body.detail
        .map((item) => (
          typeof item === "object" && item !== null && "msg" in item
            ? String(item.msg)
            : null
        ))
        .filter((message): message is string => message !== null);
      return messages.length > 0 ? messages.join(" ") : null;
    }
  } catch {
    // The status-based fallback remains useful for non-JSON responses.
  }
  return null;
}
