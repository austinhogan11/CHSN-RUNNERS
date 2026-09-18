import { afterEach, describe, expect, it, vi } from "vitest";

import { formatCalendarDate, formatLocalDate } from "./date";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("formatCalendarDate", () => {
  it.each(["America/New_York", "Asia/Tokyo"])("preserves a date-only API value in %s", (timezone) => {
    vi.stubEnv("TZ", timezone);
    expect(formatCalendarDate("2026-09-14", { weekday: "short", month: "short", day: "numeric" })).toBe("Mon, Sep 14");
  });
});

describe("formatLocalDate", () => {
  it.each([
    [2026, 0, 5, "2026-01-05"],
    [2026, 8, 20, "2026-09-20"],
    [2026, 11, 31, "2026-12-31"],
    [2028, 1, 29, "2028-02-29"],
  ])("formats local date %i/%i/%i as %s", (year, month, day, expected) => {
    expect(formatLocalDate(new Date(year, month, day))).toBe(expected);
  });

  it("keeps Sunday evening in the local week after UTC has reached Monday", () => {
    vi.stubEnv("TZ", "America/New_York");
    const date = new Date("2026-09-21T00:30:00Z");

    expect(date.toISOString().slice(0, 10)).toBe("2026-09-21");
    expect(formatLocalDate(date)).toBe("2026-09-20");
  });

  it("moves to Monday at local midnight", () => {
    vi.stubEnv("TZ", "America/New_York");

    expect(formatLocalDate(new Date("2026-09-21T03:59:59Z"))).toBe("2026-09-20");
    expect(formatLocalDate(new Date("2026-09-21T04:00:00Z"))).toBe("2026-09-21");
  });

  it("uses the local next day in a timezone ahead of UTC", () => {
    vi.stubEnv("TZ", "Asia/Tokyo");
    const date = new Date("2026-09-20T15:30:00Z");

    expect(date.toISOString().slice(0, 10)).toBe("2026-09-20");
    expect(formatLocalDate(date)).toBe("2026-09-21");
  });
});
