import { describe, it, expect } from "vitest";
import { D, round2, sum, moneyEquals, ZERO } from "./money";

// Money must be exact — these guard against float drift (0.1 + 0.2 !== 0.3).

describe("money helpers", () => {
  it("adds without float error", () => {
    expect(D(0.1).plus(0.2).toFixed(2)).toBe("0.30");
  });

  it("round2 rounds half up to two places", () => {
    expect(round2(1.005).toFixed(2)).toBe("1.01");
    expect(round2(2.344).toFixed(2)).toBe("2.34");
    expect(round2(2.345).toFixed(2)).toBe("2.35");
  });

  it("sum totals a list exactly", () => {
    expect(sum([0.1, 0.2, 0.3]).toFixed(2)).toBe("0.60");
    expect(sum([]).equals(ZERO)).toBe(true);
  });

  it("moneyEquals compares to the cent", () => {
    expect(moneyEquals(100, 100.004)).toBe(true); // rounds to 100.00
    expect(moneyEquals(100, 100.006)).toBe(false); // rounds to 100.01
  });
});
