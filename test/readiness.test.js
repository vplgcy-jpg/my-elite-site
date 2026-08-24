import { describe, it, expect } from "vitest";
import { readiness } from "../src/lib/coach.js";
import { newState } from "../src/lib/state.js";

/* One logged session. `short` sets come up under target, `undone` are never done. */
function sess({ day = 1, sets = 10, short = 0, undone = 0, hard = 0, target = 6 }) {
  const arr = Array.from({ length: sets }, (_, i) => {
    if (i < undone) return { done: false, reps: null, hard: false };
    if (i < undone + short) return { done: true, reps: target - 3, hard: i < hard };
    return { done: true, reps: target, hard: i < hard };
  });
  return {
    date: new Date(2026, 2, day).toISOString(),
    cycle: 1, phase: 0, mainLift: "bench",
    setsTotal: sets, setsDone: arr.filter((s) => s.done).length,
    exercises: [{ name: "Bench Press", kind: "main", weight: 140, targetSets: sets, targetReps: target, sets: arr }],
  };
}

const st = (history, symptoms = []) => ({ ...newState(), history, symptoms });

describe("readiness", () => {
  it("says nothing until there's something to read", () => {
    expect(readiness(st([])).status).toBe("unknown");
    expect(readiness(st([sess({})])).status).toBe("unknown");
  });

  it("confirms you're absorbing the work when the reps are there", () => {
    const r = readiness(st([sess({ day: 1 }), sess({ day: 3 }), sess({ day: 5 })]));
    expect(r.status).toBe("absorbing");
    expect(r.metrics.completion).toBe(1);
    expect(r.suggestion).toBeNull();
    expect(r.headline).toMatch(/absorbing/i);
  });

  it("warns early when sets start coming up short", () => {
    const r = readiness(st([sess({ short: 1 }), sess({ day: 3, short: 2 }), sess({ day: 5, short: 1 })]));
    expect(r.status).toBe("watch");
    expect(r.suggestion).toMatch(/Hold here/i);
  });

  it("calls it when the volume has outrun recovery", () => {
    const r = readiness(st([
      sess({ short: 4, undone: 3 }),
      sess({ day: 3, short: 4, undone: 3 }),
      sess({ day: 5, short: 4, undone: 3 }),
    ]));
    expect(r.status).toBe("digging");
    expect(r.suggestion).toMatch(/3-day|deload/i);
  });

  it("treats unfinished sessions as the clearest signal", () => {
    const r = readiness(st([sess({ undone: 5 }), sess({ day: 3, undone: 5 }), sess({ day: 5, undone: 5 })]));
    expect(r.metrics.abandonRate).toBeGreaterThan(0.2);
    expect(r.why.some((w) => /don't finish|undone/i.test(w.text))).toBe(true);
  });

  it("lets a flaring shoulder outrank good rep numbers", () => {
    const clean = [sess({ day: 1 }), sess({ day: 3 }), sess({ day: 5 })];
    const sore = [
      { date: new Date(2026, 2, 5).toISOString(), level: 4 },
      { date: new Date(2026, 2, 4).toISOString(), level: 4 },
    ];
    expect(readiness(st(clean)).status).toBe("absorbing");
    const r = readiness(st(clean, sore));
    expect(r.status).not.toBe("absorbing");
    expect(r.why.some((w) => /shoulder/i.test(w.text))).toBe(true);
  });

  it("only ever suggests, never changes anything", () => {
    const before = st([sess({ short: 5, undone: 4 }), sess({ day: 3, short: 5, undone: 4 })]);
    const snapshot = JSON.stringify(before);
    readiness(before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("reads only the recent window, not all history", () => {
    const old = Array.from({ length: 10 }, (_, i) => sess({ day: i + 1, short: 8 }));
    const recent = [sess({ day: 20 }), sess({ day: 21 }), sess({ day: 22 })];
    const r = readiness(st([...recent, ...old]), 3);
    expect(r.sessions).toBe(3);
    expect(r.status).toBe("absorbing");
  });

  it("ignores legacy rows with no per-set detail", () => {
    const legacy = { date: "2026-01-01", cycle: 1, legacy: true, exercises: null };
    expect(readiness(st([legacy, legacy, legacy])).status).toBe("unknown");
  });
});
