import { describe, it, expect } from "vitest";
import * as S from "../src/lib/state.js";
import { load, save, KEY } from "../src/lib/storage.js";

/* A state exactly as the PREVIOUS deployed build would have written it:
   no swaps, no notes, no skipped, no per-set style. If any recent change
   broke reading this, a real user's log is gone. */
const OLD_SAVE = {
  v: 2,
  program: "short3",
  tm: { bench: 125, squat: 205, deadlift: 255, ohp: 0 },
  phase: 1,
  cycle: 2,
  repeats: { bench: 1 },
  log: {
    c2p1d0: {
      sets: { "main-0": { done: true, reps: null, hard: false }, "main-1": { done: true, reps: 4, hard: true } },
      weights: { a0: 115 },
      mobility: { "pre-0": true },
    },
  },
  history: [
    {
      date: "2026-08-20T18:00:00.000Z",
      program: "short3",
      day: "Lower Power",
      dayIdx: 1,
      cycle: 1,
      phase: 0,
      mainLift: "squat",
      exercises: [
        {
          name: "Squats", kind: "main", lift: "squat", weight: 145,
          targetSets: 4, targetReps: 6,
          sets: [
            { done: true, reps: null, hard: false },
            { done: true, reps: null, hard: false },
            { done: true, reps: 5, hard: true },
            { done: false, reps: null, hard: false },
          ],
        },
      ],
      setsDone: 3,
      setsTotal: 21,
    },
  ],
  lastWeights: { "Chest-supported row": 115, "Leg press": 180 },
  symptoms: [{ date: "2026-08-20T19:00:00.000Z", level: 3, note: "rows" }],
  mobilityLog: {},
  injuries: [
    { id: "periscap-r", region: "periscapular", side: "right", label: "Right periscapular (SI14 / SI15)", stage: "healing", since: "age 18", keep: ["Deadlifts", "Deadlifts (dynamic)"], muted: false },
  ],
  food: { "2026-08-20": [{ id: "whey", servings: 2 }] },
  customFoods: [],
  foodOverrides: { whey: { protein: 30 } },
  targets: { cal: 2900, protein: 175 },
  bodyweight: 175,
  settings: { restMain: 210, restDynamic: 90, restAccessory: 90, sound: true, vibrate: true, showWarmups: true, adaptDay: true, bar: 45 },
};

describe("upgrading a log written by the previous build", () => {
  const m = () => S.migrate(structuredClone(OLD_SAVE));

  it("keeps the training maxes", () => {
    expect(m().tm).toEqual(OLD_SAVE.tm);
  });

  it("keeps position in the program", () => {
    expect(m().cycle).toBe(2);
    expect(m().phase).toBe(1);
    expect(m().repeats.bench).toBe(1);
  });

  it("keeps every logged session with its per-set detail", () => {
    const h = m().history;
    expect(h).toHaveLength(1);
    expect(h[0].exercises[0].sets[2]).toMatchObject({ done: true, reps: 5, hard: true });
  });

  it("keeps the in-progress session", () => {
    expect(S.getLog(m(), 0).sets["main-1"]).toMatchObject({ done: true, reps: 4 });
    expect(S.getLog(m(), 0).weights.a0).toBe(115);
  });

  it("keeps remembered accessory weights, symptoms and food", () => {
    const s = m();
    expect(s.lastWeights["Leg press"]).toBe(180);
    expect(s.symptoms).toHaveLength(1);
    expect(s.food["2026-08-20"][0].servings).toBe(2);
    expect(s.foodOverrides.whey.protein).toBe(30);
  });

  it("keeps the injury configuration exactly", () => {
    expect(m().injuries[0]).toEqual(OLD_SAVE.injuries[0]);
  });

  it("backfills the new fields without disturbing anything", () => {
    const s = m();
    expect(s.swaps).toEqual({});
    expect(s.notes).toEqual({});
  });

  it("reads a log that predates the skipped/note fields", () => {
    const s = m();
    const log = S.getLog(s, 0);
    expect(S.isSkipped(log, "main")).toBe(false);
    const { exercises } = S.sessionFor(s, 0);
    expect(() => S.countSets(exercises, log)).not.toThrow();
    expect(S.countDone(log, exercises)).toBe(2);
  });

  it("can still finish a session started on the old build", () => {
    const s = m();
    const done = S.finishSession(s, 0);
    expect(done.history).toHaveLength(2);
    expect(done.history[0].setsDone).toBe(2);
  });

  it("round-trips through real storage untouched", async () => {
    await save(OLD_SAVE);
    const r = await load();
    expect(r.ok).toBe(true);
    expect(r.empty).toBe(false);
    const s = S.migrate(r.value);
    expect(s.tm.squat).toBe(205);
    expect(s.history).toHaveLength(1);
  });

  it("REGRESSION: an existing log is never mistaken for a fresh install", async () => {
    window.localStorage.setItem(KEY, JSON.stringify(OLD_SAVE));
    const r = await load();
    expect(r.empty).toBe(false);
    expect(r.value.history).toHaveLength(1);
  });
});
