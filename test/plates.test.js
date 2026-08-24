import { describe, it, expect } from "vitest";
import { plateMath, plateText } from "../src/lib/plates.js";

describe("plateMath", () => {
  it("returns an empty load for a bare bar", () => {
    expect(plateMath(45)).toEqual([]);
    expect(plateText(45)).toBe("just the bar");
  });
  it("loads the heaviest plates first", () => {
    expect(plateMath(135).map((p) => p.w)).toEqual([45]);
    expect(plateMath(225).map((p) => p.w)).toEqual([45, 45]);
    expect(plateMath(185).map((p) => p.w)).toEqual([45, 25]);
  });
  it("uses the small plates for odd loads", () => {
    expect(plateMath(140).map((p) => p.w)).toEqual([45, 2.5]);
    expect(plateMath(155).map((p) => p.w)).toEqual([45, 10]);
  });
  it("returns null below bar weight", () => {
    expect(plateMath(40)).toBeNull();
    expect(plateMath(0)).toBeNull();
  });
  it("returns null when the load can't be made from standard plates", () => {
    expect(plateMath(46)).toBeNull();
  });
  it("handles a non-standard bar", () => {
    expect(plateMath(75, 35).map((p) => p.w)).toEqual([10, 10]);
  });
  it("always sums back to the requested weight", () => {
    for (const w of [95, 135, 185, 225, 275, 315, 405]) {
      const total = plateMath(w).reduce((s, p) => s + p.w, 0) * 2 + 45;
      expect(total).toBe(w);
    }
  });
  it("survives junk input", () => {
    expect(plateMath(null)).toBeNull();
    expect(plateMath(NaN)).toBeNull();
    expect(plateMath(-100)).toBeNull();
  });
});
