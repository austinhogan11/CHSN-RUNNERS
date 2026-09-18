import type { MileageTrendPoint, WeekSummary } from "./types";

const API_BASE = "/api";

export async function getWeek(date: string): Promise<WeekSummary> {
  const response = await fetch(`${API_BASE}/weeks/${date}`);

  if (!response.ok) {
    throw new Error(`Failed to load week: ${response.status}`);
  }

  return response.json() as Promise<WeekSummary>;
}

export async function getMileageTrend(
  end: string,
  weeks = 12,
): Promise<MileageTrendPoint[]> {
  const params = new URLSearchParams({
    end,
    weeks: String(weeks),
  });

  const response = await fetch(`${API_BASE}/trends/mileage?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to load mileage trend: ${response.status}`);
  }

  return response.json() as Promise<MileageTrendPoint[]>;
}