import { describe, expect, it } from "vitest";

import { calculateAveragePaceSeconds, parseDurationInput } from "./utils";

describe("calculateAveragePaceSeconds", () => {
  it("derives rounded seconds per mile", () => {
    expect(calculateAveragePaceSeconds(2460, 5.1)).toBe(482);
    expect(calculateAveragePaceSeconds(965, 2)).toBe(483);
  });

  it.each([
    [null, 5],
    [2400, null],
    [2400, 0],
  ])("returns null when duration or positive distance is unavailable", (duration, distance) => {
    expect(calculateAveragePaceSeconds(duration, distance)).toBeNull();
  });
});

describe("parseDurationInput", () => {
  it.each([
    ["41:00", 2460],
    ["1:02:18", 3738],
    ["90:05", 5405],
    ["", null],
  ])("parses %s", (value, expected) => {
    expect(parseDurationInput(value)).toBe(expected);
  });

  it.each(["pace", "1", "1:60", "1:60:00", "1:02:99"])(
    "rejects invalid duration %s",
    (value) => {
      expect(() => parseDurationInput(value)).toThrow();
    },
  );
});
