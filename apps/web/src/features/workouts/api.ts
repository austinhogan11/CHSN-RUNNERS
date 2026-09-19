import type { MileageTrendPoint, WeekSummary } from "./types";

const API_BASE = "/api";

function authorizationHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
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
