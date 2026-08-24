import { describe, it, expect } from "vitest";
import * as S from "../src/lib/state.js";
import { PHASES } from "../src/lib/program.js";

const base = () => S.newState({ tm: { bench: 200, squat: 300, deadlift: 350 } });

describe("newState", () => {
  it("starts at cycle 1 phase 1 with an empty log", () => {
    const s = base();
    expect(s.cycle).toBe(1);
    expect(s.phase).toBe(0);
    expect(s.history).toEqual([]);
    expect(s.v).toBe(S.SCHEMA);
  });
  it("carries the default injury profile and rest settings", () => {
    const s = base();
    expect(s.injuries.length).toBeGreaterThan(0);
    expect(s.settings.restMain).toBeGreaterThan(0);
  });
});

describe("migrate", () => {
  it("upgrades a v1 state without losing maxes or position", () => {
    const v1 = {
      tm: { bench: 195, squat: 285, deadlift: 315, ohp: 105 },
      phase: 1, cycle: 3, log: {}, history: [], testMode: false,
    };
    const m = S.migrate(v1);
    expect(m.v).toBe(S.SCHEMA);
    expect(m.tm.bench).toBe(195);
    expect(m.phase).toBe(1);
    expect(m.cycle).toBe(3);
  });

  it("keeps old history rows but marks them as having no per-set detail", () => {
    const v1 = {
      tm: {}, phase: 0, cycle: 1, log: {},
      history: [{ date: "2026-01-01T00:00:00.000Z", day: "Upper Power", cycle: 1, phase: 0, mainLift: "Bench Press", mainWeight: 185, mainSets: "4×6", setsDone: 12, setsTotal: 17 }],
    };
    const m = S.migrate(v1);
    expect(m.history).toHaveLength(1);
    expect(m.history[0].legacy).toBe(true);
    expect(m.history[0].exercises).toBeNull();
    expect(m.history[0].summary).toContain("185");
  });

  it("leaves a current-schema state alone but backfills new settings", () => {
    const s = base();
    delete s.settings.bar;
    const m = S.migrate(s);
    expect(m.settings.bar).toBe(45);
    expect(m.tm.bench).toBe(200);
  });

  it("returns null for junk", () => {
    expect(S.migrate(null)).toBeNull();
    expect(S.migrate("nope")).toBeNull();
  });
});

describe("logging sets", () => {
  it("marks a set done in one call and undoes it in another", () => {
    let s = base();
    s = S.toggleSet(s, 0, "main", 0);
    expect(S.getLog(s, 0).sets["main-0"].done).toBe(true);
    s = S.toggleSet(s, 0, "main", 0);
    expect(S.getLog(s, 0).sets["main-0"]).toBeUndefined();
  });

  it("defaults to no explicit rep count, meaning you hit the target", () => {
    const s = S.toggleSet(base(), 0, "main", 0);
    expect(S.getLog(s, 0).sets["main-0"].reps).toBeNull();
  });

  it("records a short set without un-marking it", () => {
    let s = S.toggleSet(base(), 0, "main", 1);
    s = S.setReps(s, 0, "main", 1, 4);
    const set = S.getLog(s, 0).sets["main-1"];
    expect(set.done).toBe(true);
    expect(set.reps).toBe(4);
  });

  it("flags a set as hard", () => {
    let s = S.toggleSet(base(), 0, "main", 0);
    s = S.markHard(s, 0, "main", 0, true);
    expect(S.getLog(s, 0).sets["main-0"].hard).toBe(true);
  });

  it("keeps each day's log separate", () => {
    let s = S.toggleSet(base(), 0, "main", 0);
    s = S.toggleSet(s, 1, "main", 0);
    expect(Object.keys(S.getLog(s, 0).sets)).toHaveLength(1);
    expect(Object.keys(S.getLog(s, 1).sets)).toHaveLength(1);
    expect(S.sessionKey(s, 0)).not.toBe(S.sessionKey(s, 1));
  });
});

describe("accessory weights", () => {
  it("remembers a weight by exercise name for next time", () => {
    const s = S.setWeight(base(), 0, "a1", "Leg press", 180);
    expect(s.lastWeights["Leg press"]).toBe(180);
    expect(S.getLog(s, 0).weights.a1).toBe(180);
  });
  it("clears cleanly without wiping the remembered value", () => {
    let s = S.setWeight(base(), 0, "a1", "Leg press", 180);
    s = S.setWeight(s, 0, "a1", "Leg press", "");
    expect(S.getLog(s, 0).weights.a1).toBeNull();
    expect(s.lastWeights["Leg press"]).toBe(180);
  });
});

describe("finishSession", () => {
  it("writes per-exercise detail, which is what the coach reads", () => {
    let s = base();
    s = S.toggleSet(s, 0, "main", 0);
    s = S.toggleSet(s, 0, "main", 1);
    s = S.setReps(s, 0, "main", 1, 4);
    const f = S.finishSession(s, 0, new Date("2026-03-01"));
    const main = f.history[0].exercises.find((e) => e.kind === "main");
    expect(main.sets[0]).toEqual({ done: true, reps: null, hard: false });
    expect(main.sets[1]).toEqual({ done: true, reps: 4, hard: false });
    expect(main.sets[2].done).toBe(false);
    expect(main.weight).toBe(140);
  });

  it("records the main lift key so the coach can find it", () => {
    const f = S.finishSession(S.toggleSet(base(), 0, "main", 0), 0);
    expect(f.history[0].mainLift).toBe("bench");
    expect(f.history[0].cycle).toBe(1);
    expect(f.history[0].phase).toBe(0);
  });

  it("clears only that day's in-progress log", () => {
    let s = S.toggleSet(base(), 0, "main", 0);
    s = S.toggleSet(s, 1, "main", 0);
    const f = S.finishSession(s, 0);
    expect(Object.keys(S.getLog(f, 0).sets)).toHaveLength(0);
    expect(Object.keys(S.getLog(f, 1).sets)).toHaveLength(1);
  });

  it("carries accessory weights into the entry and into memory", () => {
    let s = { ...base(), settings: { ...base().settings, adaptDay: false } };
    s = S.setWeight(s, 0, "a1", "Pull ups (assisted ok)", 25);
    s = S.toggleSet(s, 0, "a1", 0);
    const f = S.finishSession(s, 0);
    const ex = f.history[0].exercises.find((e) => e.name === "Pull ups (assisted ok)");
    expect(ex.weight).toBe(25);
    expect(f.lastWeights["Pull ups (assisted ok)"]).toBe(25);
  });

  it("logs the substituted movement, not the one it replaced", () => {
    // What you ticked and what gets logged must never disagree.
    let s = S.toggleSet(base(), 0, "a0", 0);
    const f = S.finishSession(s, 0);
    const swapped = f.history[0].exercises.find((e) => e.substitutedFrom);
    expect(swapped.name).toBe("Chest-supported row");
    expect(swapped.substitutedFrom).toBe("T bar rows");
    expect(f.history[0].adapted).toBe(true);
  });

  it("counts sets excluding the warm-up ramp", () => {
    const f = S.finishSession(S.toggleSet(base(), 0, "main", 0), 0);
    const e = f.history[0];
    // 4 main + 2 speed + accessories. Warm-ups are never in here.
    expect(e.setsTotal).toBe(e.exercises.reduce((n, x) => n + x.targetSets, 0));
    expect(e.setsDone).toBe(1);
  });

  it("notes whether you warmed up", () => {
    let s = S.toggleMobility(base(), 0, "pre", 0);
    s = S.toggleSet(s, 0, "main", 0);
    expect(S.finishSession(s, 0).history[0].mobilityPre).toBe(true);
  });

  it("puts the newest session first", () => {
    let s = S.finishSession(S.toggleSet(base(), 0, "main", 0), 0, new Date("2026-01-01"));
    s = S.finishSession(S.toggleSet(s, 1, "main", 0), 1, new Date("2026-01-03"));
    expect(new Date(s.history[0].date) > new Date(s.history[1].date)).toBe(true);
  });
});

describe("sessionFor", () => {
  it("substitutes flagged movements by default", () => {
    const { exercises, adapted, need } = S.sessionFor(base(), 0);
    expect(adapted).toBe(true);
    expect(need.recommended).toBe(true);
    expect(exercises.map((e) => e.name)).toContain("Chest-supported row");
    expect(exercises.map((e) => e.name)).not.toContain("T bar rows");
  });

  it("leaves the day as written when adaptation is off", () => {
    const s = { ...base(), settings: { ...base().settings, adaptDay: false } };
    const { exercises, adapted } = S.sessionFor(s, 0);
    expect(adapted).toBe(false);
    expect(exercises.map((e) => e.name)).toContain("T bar rows");
  });

  it("never substitutes the main lift you chose to keep", () => {
    const { exercises } = S.sessionFor(base(), 2); // deadlift day
    const main = exercises.find((e) => e.kind === "main");
    expect(main.name).toBe("Deadlifts");
    expect(main.substitutedFrom).toBeUndefined();
  });

  it("keeps the set count intact for a straight movement swap", () => {
    const asWritten = S.sessionFor({ ...base(), settings: { ...base().settings, adaptDay: false } }, 0);
    const adapted = S.sessionFor(base(), 0);
    expect(adapted.exercises).toHaveLength(asWritten.exercises.length);
    const row = adapted.exercises.find((e) => e.substitutedFrom === "T bar rows");
    expect(row.targetSets).toBe(4);
    expect(row.targetReps).toBe("6");
  });

  it("does nothing at all with no injuries", () => {
    const clean = { ...base(), injuries: [] };
    const { adapted, need } = S.sessionFor(clean, 0);
    expect(adapted).toBe(false);
    expect(need.count).toBe(0);
  });
});

describe("suggestNextDay", () => {
  it("starts at the first day with no history", () => {
    expect(S.suggestNextDay(base())).toBe(0);
  });
  it("offers the day after your last one", () => {
    const s = S.finishSession(S.toggleSet(base(), 0, "main", 0), 0);
    expect(S.suggestNextDay(s)).toBe(1);
  });
  it("wraps around at the end of the week", () => {
    const s = S.finishSession(S.toggleSet(base(), 2, "main", 0), 2);
    expect(S.suggestNextDay(s)).toBe(0);
  });
});

describe("phase movement", () => {
  it("advances one phase at a time and stops at phase 3", () => {
    let s = base();
    s = S.advancePhase(s);
    expect(s.phase).toBe(1);
    s = S.advancePhase(S.advancePhase(s));
    expect(s.phase).toBe(PHASES.length - 1);
  });
  it("ends a deload by starting the next cycle", () => {
    const s = S.endDeload({ ...base(), phase: 3, cycle: 2 });
    expect(s.phase).toBe(0);
    expect(s.cycle).toBe(3);
  });
});

describe("symptom log", () => {
  it("records level and note newest first", () => {
    let s = S.logSymptom(base(), { level: 3, note: "rows" }, new Date("2026-01-01"));
    s = S.logSymptom(s, { level: 1, note: null }, new Date("2026-01-02"));
    expect(s.symptoms).toHaveLength(2);
    expect(s.symptoms[0].level).toBe(1);
    expect(s.symptoms[1].note).toBe("rows");
  });
});
