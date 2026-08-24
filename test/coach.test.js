import { describe, it, expect } from "vitest";
import {
  liftStats, recommendForLift, coachReport, applyRecommendations,
  inSessionAdvice, strengthSeries,
} from "../src/lib/coach.js";
import { PHASES, LIFT_STEP } from "../src/lib/program.js";
import { newState } from "../src/lib/state.js";

/* One logged session for a main lift. repsPerSet lets a test make sets short. */
function session({ cycle = 1, phase = 0, lift = "bench", weight = 140, repsPerSet, hard = 0 }) {
  const p = PHASES[phase];
  const reps = repsPerSet || Array(p.sets).fill(p.reps);
  return {
    date: new Date(2026, 0, 1 + phase * 7).toISOString(),
    program: "short3",
    day: "Upper Power",
    dayIdx: 0,
    cycle,
    phase,
    mainLift: lift,
    exercises: [
      {
        name: "Bench Press", kind: "main", lift, weight,
        targetSets: p.sets, targetReps: p.reps,
        sets: reps.map((r, i) => ({ done: r != null, reps: r, hard: i < hard })),
      },
    ],
    setsDone: reps.filter((r) => r != null).length,
    setsTotal: p.sets,
  };
}

const cleanCycle = (lift = "bench") => [0, 1, 2].map((phase) => session({ phase, lift }));

const withState = (history, over = {}) => ({
  ...newState(),
  history,
  cycle: 1,
  ...over,
});

describe("liftStats", () => {
  it("counts prescribed and performed reps across a full cycle", () => {
    const st = liftStats(cleanCycle(), 1, "bench");
    // 4x6 + 5x5 + 7x4 = 24 + 25 + 28
    expect(st.prescribed).toBe(77);
    expect(st.performed).toBe(77);
    expect(st.completion).toBe(1);
    expect(st.phasesCovered).toBe(3);
    expect(st.missedSets).toBe(0);
  });

  it("treats an unrecorded rep count as hitting the target", () => {
    const s = session({ phase: 0, repsPerSet: [null, 6, 6, 6] });
    s.exercises[0].sets[0] = { done: true, reps: null, hard: false };
    const st = liftStats([s], 1, "bench");
    expect(st.performed).toBe(24);
    expect(st.missedSets).toBe(0);
  });

  it("counts short sets", () => {
    const st = liftStats([session({ phase: 0, repsPerSet: [6, 6, 4, 3] })], 1, "bench");
    expect(st.missedSets).toBe(2);
    expect(st.performed).toBe(19);
  });

  it("ignores sets that were never done", () => {
    const st = liftStats([session({ phase: 0, repsPerSet: [6, 6, null, null] })], 1, "bench");
    expect(st.doneSets).toBe(2);
    expect(st.performed).toBe(12);
    expect(st.missedSets).toBe(0);
  });

  it("ignores other cycles and other lifts", () => {
    const h = [...cleanCycle("bench"), ...cleanCycle("squat"), session({ cycle: 9 })];
    expect(liftStats(h, 1, "bench").sessions).toBe(3);
  });

  it("ignores legacy rows with no exercise detail", () => {
    const legacy = { cycle: 1, mainLift: "bench", phase: 0, legacy: true, exercises: null };
    expect(liftStats([legacy], 1, "bench").sessions).toBe(0);
  });

  it("survives empty history", () => {
    expect(liftStats([], 1, "bench").prescribed).toBe(0);
    expect(liftStats(undefined, 1, "bench").completion).toBe(0);
  });
});

describe("recommendForLift", () => {
  it("waits until all three phases are logged", () => {
    const s = withState([session({ phase: 0 })], { tm: { bench: 200 } });
    const r = recommendForLift(s, "bench");
    expect(r.status).toBe("in-progress");
    expect(r.delta).toBe(0);
  });

  it("adds the full step after a clean cycle", () => {
    const s = withState(cleanCycle(), { tm: { bench: 200 } });
    const r = recommendForLift(s, "bench");
    expect(r.status).toBe("increase");
    expect(r.delta).toBe(LIFT_STEP.bench);
    expect(r.headline).toContain("205");
  });

  it("gives lower-body lifts the top of the program's 5-10 lb range", () => {
    const s = withState(cleanCycle("squat"), { tm: { squat: 300 } });
    const r = recommendForLift(s, "squat");
    expect(r.delta).toBe(10);
    expect(r.headline).toContain("310");
  });

  it("cites the program, not just itself", () => {
    const s = withState(cleanCycle(), { tm: { bench: 200 } });
    const r = recommendForLift(s, "bench");
    expect(r.why.some((w) => w.src === "Saiyan program")).toBe(true);
    expect(r.why.every((w) => w.text.length > 0)).toBe(true);
  });

  it("takes the small step after a single short rep", () => {
    const h = cleanCycle();
    h[2].exercises[0].sets[6] = { done: true, reps: 3, hard: false }; // one rep short
    const s = withState(h, { tm: { bench: 200 } });
    const r = recommendForLift(s, "bench");
    expect(r.status).toBe("increase-small");
    expect(r.delta).toBe(5);
  });

  it("repeats the cycle after real failure", () => {
    const h = cleanCycle();
    h[2].exercises[0].sets = h[2].exercises[0].sets.map(() => ({ done: true, reps: 2, hard: false }));
    const s = withState(h, { tm: { bench: 200 } });
    const r = recommendForLift(s, "bench");
    expect(r.status).toBe("repeat");
    expect(r.delta).toBe(0);
    expect(r.headline).toContain("200");
  });

  it("sends you to deload after two stalls", () => {
    const s = withState(cleanCycle(), { tm: { bench: 200 }, repeats: { bench: 2 } });
    const r = recommendForLift(s, "bench");
    expect(r.status).toBe("deload");
  });

  it("reports a missing training max instead of guessing", () => {
    const s = withState([], { tm: { bench: 0 } });
    expect(recommendForLift(s, "bench").status).toBe("no-max");
  });

  it("mentions hard-flagged sets when it still recommends a jump", () => {
    const h = [0, 1, 2].map((phase) => session({ phase, hard: 2 }));
    const s = withState(h, { tm: { bench: 200 } });
    const r = recommendForLift(s, "bench");
    expect(r.status).toBe("increase");
    expect(r.why.some((w) => /hard/i.test(w.text))).toBe(true);
  });
});

describe("coachReport", () => {
  it("is not ready while any lift is mid-cycle", () => {
    const s = withState([...cleanCycle("bench"), session({ lift: "squat", phase: 0 })], {
      tm: { bench: 200, squat: 300, deadlift: 350 },
    });
    expect(coachReport(s).ready).toBe(false);
  });

  it("is ready once every lift with a max has a full cycle", () => {
    const s = withState(
      [...cleanCycle("bench"), ...cleanCycle("squat"), ...cleanCycle("deadlift")],
      { tm: { bench: 200, squat: 300, deadlift: 350 } }
    );
    const r = coachReport(s);
    expect(r.ready).toBe(true);
    expect(r.perLift).toHaveLength(3);
  });

  it("flags a deload when any single lift has stalled twice", () => {
    const s = withState(
      [...cleanCycle("bench"), ...cleanCycle("squat"), ...cleanCycle("deadlift")],
      { tm: { bench: 200, squat: 300, deadlift: 350 }, repeats: { squat: 2 } }
    );
    expect(coachReport(s).anyDeload).toBe(true);
  });
});

describe("applyRecommendations", () => {
  const full = () =>
    withState([...cleanCycle("bench"), ...cleanCycle("squat"), ...cleanCycle("deadlift")], {
      tm: { bench: 200, squat: 300, deadlift: 350, ohp: 0 },
    });

  it("raises the maxes and starts the next cycle", () => {
    const s = full();
    const next = applyRecommendations(s, coachReport(s));
    expect(next.tm.bench).toBe(205);
    expect(next.tm.squat).toBe(310);
    expect(next.cycle).toBe(2);
    expect(next.phase).toBe(0);
    expect(next.log).toEqual({});
  });

  it("bumps the repeat counter for a lift that held", () => {
    const s = full();
    s.history[2].exercises[0].sets = s.history[2].exercises[0].sets.map(() => ({ done: true, reps: 1, hard: false }));
    const next = applyRecommendations(s, coachReport(s));
    expect(next.tm.bench).toBe(200);
    expect(next.repeats.bench).toBe(1);
    expect(next.tm.squat).toBe(310);
  });

  it("resets the repeat counter once a lift progresses", () => {
    const s = full();
    s.repeats = { bench: 1 };
    const next = applyRecommendations(s, coachReport(s));
    expect(next.repeats.bench).toBe(0);
  });

  it("routes to the deload week without advancing the cycle", () => {
    const s = full();
    s.repeats = { bench: 2 };
    const next = applyRecommendations(s, coachReport(s));
    expect(next.phase).toBe(3);
    expect(next.cycle).toBe(1);
  });

  it("leaves lifts with no max alone", () => {
    const s = full();
    expect(applyRecommendations(s, coachReport(s)).tm.ohp).toBe(0);
  });
});

describe("inSessionAdvice", () => {
  it("says nothing when you hit the target", () => {
    expect(inSessionAdvice(200, 6, 6)).toBeNull();
    expect(inSessionAdvice(200, 6, 7)).toBeNull();
  });
  it("holds the weight when you're one short", () => {
    const a = inSessionAdvice(200, 6, 5);
    expect(a.tone).toBe("warn");
    expect(a.drop).toBe(0);
  });
  it("drops 10% when you're well short", () => {
    const a = inSessionAdvice(200, 6, 3);
    expect(a.tone).toBe("fail");
    expect(a.drop).toBe(180);
    expect(a.text).toMatch(/never grind/i);
  });
  it("handles a range target like 8-10 without crashing", () => {
    expect(inSessionAdvice(100, "8-10", 8)).toBeNull();
  });
});

describe("strengthSeries", () => {
  it("returns one point per session, oldest first", () => {
    const pts = strengthSeries(cleanCycle(), "bench");
    expect(pts).toHaveLength(3);
    expect(new Date(pts[0].date) <= new Date(pts[2].date)).toBe(true);
  });

  it("uses the best set so one bad set doesn't sink the point", () => {
    const s = session({ phase: 0, repsPerSet: [6, 2, 2, 2] });
    const [p] = strengthSeries([s], "bench");
    expect(p.e1rm).toBe(168); // from the 6-rep set, not the 2s
  });

  it("moves on performance, not just on the training max going up", () => {
    // Same bar weight, more reps -> the line rises. A TM-derived chart couldn't show this.
    const a = session({ phase: 0, weight: 140, repsPerSet: [4, 4, 4, 4] });
    const b = { ...session({ phase: 1, weight: 140, repsPerSet: [8, 8, 8, 8, 8] }) };
    const pts = strengthSeries([a, b], "bench");
    expect(pts[1].e1rm).toBeGreaterThan(pts[0].e1rm);
  });

  it("skips sessions with nothing completed", () => {
    const s = session({ phase: 0, repsPerSet: [null, null, null, null] });
    expect(strengthSeries([s], "bench")).toHaveLength(0);
  });

  it("survives empty input", () => {
    expect(strengthSeries([], "bench")).toEqual([]);
    expect(strengthSeries(undefined, "bench")).toEqual([]);
  });
});
