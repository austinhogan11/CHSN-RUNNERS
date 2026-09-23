export function formatLocalDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatCalendarDate(day: string, options: Intl.DateTimeFormatOptions): string {
  // A date-only API value is a calendar day, not a UTC timestamp.
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString("en-US", options);
}

export function getWeekDates(weekStart: string): string[] {
  const [year, month, day] = weekStart.split("-").map(Number);
  const start = new Date(year, month - 1, day);

  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    return formatLocalDate(date);
  });
}

export function addCalendarDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const result = new Date(year, month - 1, date);
  result.setDate(result.getDate() + days);
  return formatLocalDate(result);
}

export function getMondayWeekStart(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(year, month - 1, date);
  const daysSinceMonday = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - daysSinceMonday);
  return formatLocalDate(value);
}

export function formatWeekRange(weekStart: string): string {
  return formatDateRange(weekStart, addCalendarDays(weekStart, 6));
}

export function formatDateRange(start: string, end: string): string {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);

  if (startYear !== endYear) {
    return `${formatCalendarDate(start, { month: "short", day: "numeric", year: "numeric" })}–${formatCalendarDate(end, { month: "short", day: "numeric", year: "numeric" })}`;
  }

  if (startMonth !== endMonth) {
    return `${formatCalendarDate(start, { month: "short", day: "numeric" })}–${formatCalendarDate(end, { month: "short", day: "numeric", year: "numeric" })}`;
  }

  return `${formatCalendarDate(start, { month: "short", day: "numeric" })}–${endDay}, ${endYear}`;
}
