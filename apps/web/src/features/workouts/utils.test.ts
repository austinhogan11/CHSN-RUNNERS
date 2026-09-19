import { describe, expect, it } from "vitest";

import { calculateAveragePaceSeconds } from "./utils";

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
