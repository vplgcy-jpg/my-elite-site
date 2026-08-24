import { describe, it, expect } from "vitest";
import {
  round5, e1rm, PHASES, DELOAD, DYN, REST, PROGRAMS,
  buildSession, warmupSets, LIFT_STEP,
} from "../src/lib/program.js";

describe("round5", () => {
  it("rounds to the nearest 5", () => {
    expect(round5(142)).toBe(140);
    expect(round5(143)).toBe(145);
    expect(round5(0)).toBe(0);
  });
});

describe("e1rm (Epley)", () => {
  it("returns the bar weight at a single rep", () => {
    expect(e1rm(200, 1)).toBe(207); // 200 * (1 + 1/30)
  });
  it("scales with reps", () => {
    expect(e1rm(200, 6)).toBe(240);
    expect(e1rm(200, 4)).toBeLessThan(e1rm(200, 6));
  });
  it("is 0 for missing input", () => {
    expect(e1rm(0, 5)).toBe(0);
    expect(e1rm(200, 0)).toBe(0);
    expect(e1rm(null, null)).toBe(0);
  });
});

describe("phases match the source program", () => {
  it("is 70% 4x6, 75% 5x5, 80% 7x4", () => {
    expect(PHASES.map((p) => [p.pct, p.sets, p.reps])).toEqual([
      [0.7, 4, 6],
      [0.75, 5, 5],
      [0.8, 7, 4],
    ]);
  });
  it("runs one week per phase, 21 days a cycle", () => {
    expect(PHASES.map((p) => p.week)).toEqual([1, 2, 3]);
  });
  it("deloads by cutting weights in half", () => {
    // 0.35 of TM is half of Phase 1's 0.70
    expect(DELOAD.pct).toBeCloseTo(PHASES[0].pct / 2, 5);
  });
  it("drops 20% for speed sets", () => {
    expect(DYN.pctOfWork).toBe(0.8);
    expect(DYN.sets).toBe(2);
  });
  it("rests inside the program's stated ranges", () => {
    expect(REST.main).toBeGreaterThanOrEqual(120);
    expect(REST.main).toBeLessThanOrEqual(300);
    expect(REST.accessory).toBeGreaterThanOrEqual(60);
    expect(REST.accessory).toBeLessThanOrEqual(120);
  });
  it("increases lower-body maxes faster, inside the 5-10 lb range", () => {
    for (const v of Object.values(LIFT_STEP)) {
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
    expect(LIFT_STEP.squat).toBeGreaterThan(LIFT_STEP.bench);
  });
});

describe("programs", () => {
  it("has a 5-day as-written and a 3-day adapted version", () => {
    expect(PROGRAMS.full5.days).toHaveLength(5);
    expect(PROGRAMS.short3.days).toHaveLength(3);
    expect(PROGRAMS.short3.adapted).toBe(true);
    expect(PROGRAMS.full5.adapted).toBe(false);
  });
  it("keeps overhead press live in the 5-day and out of the 3-day", () => {
    expect(PROGRAMS.full5.lifts).toContain("ohp");
    expect(PROGRAMS.short3.lifts).not.toContain("ohp");
  });
  it("gives the 5-day version a percentage lift on four days", () => {
    expect(PROGRAMS.full5.days.filter((d) => d.main).map((d) => d.main))
      .toEqual(["bench", "squat", "ohp", "deadlift"]);
  });
});

describe("buildSession", () => {
  const tm = { bench: 200, squat: 300, deadlift: 350, ohp: 120 };

  it("computes the main lift from the phase percentage", () => {
    const { exercises } = buildSession("short3", 0, 0, tm);
    const main = exercises.find((e) => e.kind === "main");
    expect(main.weight).toBe(140); // 200 * 0.70
    expect(main.targetSets).toBe(4);
    expect(main.targetReps).toBe(6);
  });

  it("drops the speed sets 20% off the working weight", () => {
    const { exercises } = buildSession("short3", 0, 0, tm);
    const dyn = exercises.find((e) => e.kind === "dynamic");
    expect(dyn.weight).toBe(round5(140 * 0.8));
    expect(dyn.targetSets).toBe(2);
  });

  it("uses phase 3's 7 sets of 4", () => {
    const { exercises } = buildSession("short3", 0, 2, tm);
    const main = exercises.find((e) => e.kind === "main");
    expect(main.weight).toBe(160); // 200 * 0.80
    expect(main.targetSets).toBe(7);
    expect(main.targetReps).toBe(4);
  });

  it("omits the main lift when no training max is set", () => {
    const { exercises } = buildSession("short3", 0, 0, { bench: 0 });
    expect(exercises.find((e) => e.kind === "main")).toBeUndefined();
    expect(exercises.every((e) => e.kind === "accessory")).toBe(true);
  });

  it("handles the 5-day accessory-only pull day", () => {
    const { day, exercises } = buildSession("full5", 2, 0, tm);
    expect(day.main).toBeNull();
    expect(exercises.every((e) => e.kind === "accessory")).toBe(true);
  });

  it("gives every exercise a rest duration", () => {
    const { exercises } = buildSession("short3", 0, 0, tm);
    expect(exercises.every((e) => e.rest > 0)).toBe(true);
  });
});

describe("warmupSets", () => {
  it("ramps from the empty bar up to just under the working weight", () => {
    const w = warmupSets(200);
    expect(w[0].weight).toBe(45);
    expect(w.every((s) => s.weight < 200)).toBe(true);
    expect(w.map((s) => s.weight)).toEqual([...w.map((s) => s.weight)].sort((a, b) => a - b));
  });
  it("returns nothing at or below bar weight", () => {
    expect(warmupSets(45)).toEqual([]);
    expect(warmupSets(0)).toEqual([]);
  });
  it("never repeats a weight", () => {
    const w = warmupSets(65);
    expect(new Set(w.map((s) => s.weight)).size).toBe(w.length);
  });
});
