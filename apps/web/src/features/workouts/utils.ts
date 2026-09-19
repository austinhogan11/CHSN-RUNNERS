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
