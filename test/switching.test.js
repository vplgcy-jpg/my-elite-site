import { describe, it, expect } from "vitest";
import * as S from "../src/lib/state.js";
import { PROGRAMS } from "../src/lib/program.js";

const base = () => S.newState({ tm: { bench: 125, squat: 200, deadlift: 250 } });

describe("switchProgram", () => {
  it("moves to the 5-day as written", () => {
    const s = S.switchProgram(base(), "full5");
    expect(s.program).toBe("full5");
    expect(PROGRAMS.full5.days).toHaveLength(5);
  });

  it("keeps maxes, history and symptoms", () => {
    let s = base();
    s = S.logSymptom(s, { level: 3, note: "rows" });
    s = S.finishSession(S.toggleSet(s, 0, "main", 0), 0);
    const after = S.switchProgram(s, "full5");
    expect(after.tm.bench).toBe(125);
    expect(after.history).toHaveLength(1);
    expect(after.symptoms).toHaveLength(1);
  });

  it("routes a lift with no max to a test day rather than a zero weight", () => {
    const s = S.switchProgram(base(), "full5");
    expect(s.tm.ohp).toBe(0);
    const { exercises } = S.sessionFor(s, 3); // push day, OHP is the percentage lift
    expect(exercises.find((e) => e.kind === "main")).toBeUndefined();
  });

  it("restores weighted dips, which the 3-day removes", () => {
    const short = S.sessionFor({ ...base(), settings: { ...base().settings, adaptDay: false } }, 0);
    expect(short.exercises.map((e) => e.name)).not.toContain("Weighted dips");
    const full = S.switchProgram(base(), "full5");
    const day1 = S.sessionFor({ ...full, settings: { ...full.settings, adaptDay: false } }, 0);
    expect(day1.exercises.map((e) => e.name)).toContain("Weighted dips");
  });

  it("clears the in-progress log, since the day's exercises changed", () => {
    const s = S.toggleSet(base(), 0, "a0", 0);
    expect(S.switchProgram(s, "full5").log).toEqual({});
  });

  it("is a no-op for an unknown or identical program", () => {
    const s = base();
    expect(S.switchProgram(s, "nope")).toBe(s);
    expect(S.switchProgram(s, "short3")).toBe(s);
  });

  it("switches back without losing anything", () => {
    let s = S.finishSession(S.toggleSet(base(), 0, "main", 0), 0);
    s = S.switchProgram(s, "full5");
    s = S.switchProgram(s, "short3");
    expect(s.program).toBe("short3");
    expect(s.history).toHaveLength(1);
  });
});

describe("bar type", () => {
  it("defaults to a 45 lb free bar", () => {
    expect(S.barFor(base(), "bench")).toEqual({ type: "free", weight: 45 });
  });

  it("uses the lighter Smith bar for plate math", () => {
    const s = S.setBar(base(), "bench", "smith");
    expect(S.barFor(s, "bench").weight).toBe(20);
  });

  it("invalidates the max when the bar type changes", () => {
    // A Smith number is not a free-bar number: lighter bar, and the fixed path
    // removes the stabiliser demand entirely.
    const s = S.setBar(base(), "bench", "smith");
    expect(s.tm.bench).toBe(0);
    expect(s.retestReason).toEqual({ lift: "bench", from: "Free barbell", to: "Smith machine" });
  });

  it("does not invalidate when only correcting the bar's weight", () => {
    let s = S.setBar(base(), "bench", "smith");
    s = { ...s, tm: { ...s.tm, bench: 100 } };
    const fixed = S.setBar(s, "bench", "smith", 25);
    expect(fixed.tm.bench).toBe(100);
    expect(S.barFor(fixed, "bench").weight).toBe(25);
  });

  it("leaves other lifts alone", () => {
    const s = S.setBar(base(), "bench", "smith");
    expect(s.tm.squat).toBe(200);
    expect(S.barFor(s, "squat").type).toBe("free");
  });

  it("clears the retest notice once acknowledged", () => {
    const s = S.clearRetestReason(S.setBar(base(), "bench", "smith"));
    expect(s.retestReason).toBeNull();
  });
});

describe("retestLift", () => {
  it("clears the max and the stall counter, keeping history", () => {
    let s = S.finishSession(S.toggleSet(base(), 0, "main", 0), 0);
    s = { ...s, repeats: { bench: 2 } };
    const r = S.retestLift(s, "bench");
    expect(r.tm.bench).toBe(0);
    expect(r.repeats.bench).toBe(0);
    expect(r.history).toHaveLength(1);
    expect(r.tm.squat).toBe(200);
  });
});
