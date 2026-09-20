export function formatDistance(distance: number | null): string {
  if (distance === null) {
    return "—";
  }

  return `${distance.toFixed(2)} mi`;
}

export function formatPace(seconds: number | null): string {
  if (seconds === null) {
    return "—";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")} /mi`;
}

export function calculateAveragePaceSeconds(
  durationSeconds: number | null,
  distance: number | null,
): number | null {
  if (durationSeconds === null || distance === null || distance <= 0) {
    return null;
  }

  return Math.round(durationSeconds / distance);
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return "—";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function parseDurationInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  const parts = trimmed.split(":");
  if (
    (parts.length !== 2 && parts.length !== 3)
    || parts.some((part) => !/^\d+$/.test(part))
  ) {
    throw new Error("Use MM:SS or HH:MM:SS");
  }

  const values = parts.map(Number);
  const seconds = values.at(-1) ?? 0;
  const minutes = values.at(-2) ?? 0;
  if (seconds > 59 || (parts.length === 3 && minutes > 59)) {
    throw new Error("Minutes and seconds must be below 60");
  }

  const hours = parts.length === 3 ? values[0] : 0;
  return hours * 3600 + minutes * 60 + seconds;
}
