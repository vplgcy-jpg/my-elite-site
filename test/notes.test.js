import { describe, it, expect } from "vitest";
import * as S from "../src/lib/state.js";
import { readiness } from "../src/lib/coach.js";

const base = () => S.newState({ tm: { bench: 135, squat: 205, deadlift: 255 } });
const ex = (s, day) => S.sessionFor(s, day).exercises;

describe("skipping an exercise", () => {
  it("takes its sets out of the day's total", () => {
    let s = base();
    const list = ex(s, 1);
    const before = S.countSets(list, S.getLog(s, 1));
    const legPress = list.find((e) => e.name === "Leg press");
    s = S.toggleSkip(s, 1, legPress.id);
    expect(S.countSets(list, S.getLog(s, 1))).toBe(before - legPress.targetSets);
  });

  it("clears anything already ticked on it", () => {
    let s = base();
    const list = ex(s, 1);
    const legPress = list.find((e) => e.name === "Leg press");
    s = S.toggleSet(s, 1, legPress.id, 0);
    s = S.toggleSet(s, 1, legPress.id, 1);
    s = S.toggleSkip(s, 1, legPress.id);
    expect(S.countDone(S.getLog(s, 1), list)).toBe(0);
  });

  it("toggles back off", () => {
    let s = base();
    const legPress = ex(s, 1).find((e) => e.name === "Leg press");
    s = S.toggleSkip(s, 1, legPress.id);
    expect(S.isSkipped(S.getLog(s, 1), legPress.id)).toBe(true);
    s = S.toggleSkip(s, 1, legPress.id);
    expect(S.isSkipped(S.getLog(s, 1), legPress.id)).toBe(false);
  });

  it("records what was skipped and leaves it out of the logged exercises", () => {
    let s = base();
    const list = ex(s, 1);
    const legPress = list.find((e) => e.name === "Leg press");
    s = S.toggleSkip(s, 1, legPress.id);
    s = S.toggleSet(s, 1, "main", 0);
    const entry = S.finishSession(s, 1).history[0];
    expect(entry.skipped).toEqual(["Leg press"]);
    expect(entry.exercises.map((e) => e.name)).not.toContain("Leg press");
    expect(entry.setsTotal).toBe(S.countSets(list) - legPress.targetSets);
  });

  it("REGRESSION: a deliberate skip is not counted as an abandoned set", () => {
    // Running out of gas and choosing to drop a movement are different things.
    // Only the first should push the recovery readout toward "digging".
    const day = (skip) => {
      let s = base();
      const list = ex(s, 1);
      if (skip) s = S.toggleSkip(s, 1, list.find((e) => e.name === "Leg press").id);
      for (const e of list) {
        if (S.isSkipped(S.getLog(s, 1), e.id)) continue;
        for (let i = 0; i < e.targetSets; i++) s = S.toggleSet(s, 1, e.id, i);
      }
      return S.finishSession(s, 1).history[0];
    };
    const skipped = { ...base(), history: [day(true), day(true), day(true)] };
    expect(readiness(skipped).metrics.abandonRate).toBe(0);
    expect(readiness(skipped).status).toBe("absorbing");
  });
});

describe("exercise notes", () => {
  it("stores a note against the movement and reads it back", () => {
    const s = S.addNote(base(), "Squats", "wider stance felt better on the hip");
    expect(S.lastNote(s, "Squats").text).toBe("wider stance felt better on the hip");
  });

  it("keeps a history, newest first, so change is visible", () => {
    let s = S.addNote(base(), "Squats", "first", new Date(2026, 0, 1));
    s = S.addNote(s, "Squats", "second", new Date(2026, 0, 8));
    expect(s.notes.Squats.map((n) => n.text)).toEqual(["second", "first"]);
    expect(S.lastNote(s, "Squats").text).toBe("second");
  });

  it("keys by movement, so notes stay with the exercise", () => {
    let s = S.addNote(base(), "Squats", "hip cue");
    s = S.addNote(s, "Deadlifts", "grip cue");
    expect(S.lastNote(s, "Squats").text).toBe("hip cue");
    expect(S.lastNote(s, "Deadlifts").text).toBe("grip cue");
  });

  it("ignores an empty note", () => {
    const s = base();
    expect(S.addNote(s, "Squats", "   ")).toBe(s);
    expect(S.addNote(s, "Squats", "")).toBe(s);
  });

  it("trims whitespace", () => {
    const s = S.addNote(base(), "Squats", "  belt on for the last two  ");
    expect(S.lastNote(s, "Squats").text).toBe("belt on for the last two");
  });

  it("returns null when there is no note", () => {
    expect(S.lastNote(base(), "Squats")).toBeNull();
  });

  it("deletes one note without touching the rest", () => {
    let s = S.addNote(base(), "Squats", "first", new Date(2026, 0, 1));
    s = S.addNote(s, "Squats", "second", new Date(2026, 0, 8));
    s = S.deleteNote(s, "Squats", new Date(2026, 0, 1).toISOString());
    expect(s.notes.Squats.map((n) => n.text)).toEqual(["second"]);
  });

  it("drops the movement entirely once its last note goes", () => {
    let s = S.addNote(base(), "Squats", "only", new Date(2026, 0, 1));
    s = S.deleteNote(s, "Squats", new Date(2026, 0, 1).toISOString());
    expect(s.notes.Squats).toBeUndefined();
  });

  it("caps the history so it can't grow without bound", () => {
    let s = base();
    for (let i = 0; i < 30; i++) s = S.addNote(s, "Squats", `note ${i}`, new Date(2026, 0, i + 1));
    expect(s.notes.Squats).toHaveLength(20);
  });
});

describe("session notes", () => {
  it("saves with the session and survives to history", () => {
    let s = S.setSessionNote(base(), 1, "slept 4 hours, everything felt heavy");
    s = S.toggleSet(s, 1, "main", 0);
    expect(S.finishSession(s, 1).history[0].note).toBe("slept 4 hours, everything felt heavy");
  });

  it("stores null rather than an empty string", () => {
    let s = S.setSessionNote(base(), 1, "   ");
    s = S.toggleSet(s, 1, "main", 0);
    expect(S.finishSession(s, 1).history[0].note).toBeNull();
  });

  it("stays with its own day", () => {
    let s = S.setSessionNote(base(), 0, "upper day note");
    s = S.setSessionNote(s, 1, "lower day note");
    expect(S.getLog(s, 0).note).toBe("upper day note");
    expect(S.getLog(s, 1).note).toBe("lower day note");
  });
});
