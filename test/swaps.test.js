import { describe, it, expect } from "vitest";
import { alternativesFor, applySwaps, isAssistable } from "../src/lib/alternatives.js";
import * as S from "../src/lib/state.js";

const base = () => S.newState({ tm: { bench: 135, squat: 205, deadlift: 255 } });

describe("alternatives", () => {
  it("covers the machines a gym might not have", () => {
    for (const m of ["Standing calf raise machine", "Seated calf machine", "Leg press", "Reverse pec deck machine"])
      expect(alternativesFor(m).length).toBeGreaterThan(0);
  });
  it("never offers a movement as its own alternative", () => {
    for (const [name, alts] of Object.entries({
      "Standing calf raise machine": alternativesFor("Standing calf raise machine"),
      "Leg press": alternativesFor("Leg press"),
    }))
      expect(alts).not.toContain(name);
  });
  it("returns nothing for an unknown movement rather than throwing", () => {
    expect(alternativesFor("Nordic sled drag")).toEqual([]);
  });
});

describe("applySwaps", () => {
  it("replaces the name and records what it stood in for", () => {
    const out = applySwaps([{ name: "Leg press", targetSets: 3 }], { "Leg press": "Hack squat" });
    expect(out[0].name).toBe("Hack squat");
    expect(out[0].swappedFrom).toBe("Leg press");
  });
  it("keeps sets and reps intact", () => {
    const out = applySwaps([{ name: "Leg press", targetSets: 3, targetReps: "10" }], { "Leg press": "Hack squat" });
    expect(out[0].targetSets).toBe(3);
    expect(out[0].targetReps).toBe("10");
  });
  it("leaves everything else alone", () => {
    const out = applySwaps(
      [{ name: "Squats" }, { name: "Leg press" }],
      { "Leg press": "Hack squat" }
    );
    expect(out[0].name).toBe("Squats");
    expect(out[0].swappedFrom).toBeUndefined();
  });
  it("is a no-op with no swaps saved", () => {
    const ex = [{ name: "Squats" }];
    expect(applySwaps(ex, undefined)).toBe(ex);
  });
});

describe("swapExercise", () => {
  it("sticks across sessions", () => {
    const s = S.swapExercise(base(), "Standing calf raise machine", "Leg press calf press");
    const names = S.sessionFor(s, 1).exercises.map((e) => e.name);
    expect(names).toContain("Leg press calf press");
    expect(names).not.toContain("Standing calf raise machine");
  });
  it("reverts when swapped back to the original", () => {
    let s = S.swapExercise(base(), "Standing calf raise machine", "Leg press calf press");
    s = S.swapExercise(s, "Standing calf raise machine", "Standing calf raise machine");
    expect(s.swaps["Standing calf raise machine"]).toBeUndefined();
    expect(S.sessionFor(s, 1).exercises.map((e) => e.name)).toContain("Standing calf raise machine");
  });
  it("applies on top of an injury substitution, not against it", () => {
    // T bar rows are already substituted for the shoulder; a gym swap layers on
    let s = base();
    expect(S.sessionFor(s, 0).exercises.map((e) => e.name)).toContain("Chest-supported row");
    s = S.swapExercise(s, "Chest-supported row", "Seated cable row");
    const names = S.sessionFor(s, 0).exercises.map((e) => e.name);
    expect(names).toContain("Seated cable row");
    expect(names).not.toContain("Chest-supported row");
  });
  it("logs the movement actually performed", () => {
    let s = S.swapExercise(base(), "Standing calf raise machine", "Leg press calf press");
    const { exercises } = S.sessionFor(s, 1);
    const idx = exercises.findIndex((e) => e.name === "Leg press calf press");
    s = S.toggleSet(s, 1, exercises[idx].id, 0);
    const logged = S.finishSession(s, 1).history[0].exercises.map((e) => e.name);
    expect(logged).toContain("Leg press calf press");
    expect(logged).not.toContain("Standing calf raise machine");
  });
});

describe("assisted and negative work", () => {
  it("recognises the movements where assistance and negatives apply", () => {
    expect(isAssistable("Pull ups (assisted ok)")).toBe(true);
    expect(isAssistable("Weighted pull ups")).toBe(true);
    expect(isAssistable("Neutral-grip lat pulldown")).toBe(false);
    expect(isAssistable("Leg press")).toBe(false);
  });

  it("records each set's style independently", () => {
    // real usage: assisted for the first few, negatives once those run out
    let s = base();
    s = S.setStyle(s, 0, "a1", 0, "assist", 45);
    s = S.setStyle(s, 0, "a1", 1, "assist", 45);
    s = S.setStyle(s, 0, "a1", 2, "negative");
    s = S.setStyle(s, 0, "a1", 3, "negative");
    const sets = S.getLog(s, 0).sets;
    expect(sets["a1-0"]).toMatchObject({ done: true, style: "assist", assist: 45 });
    expect(sets["a1-2"].style).toBe("negative");
  });

  it("marks a styled set as done without needing a separate tap", () => {
    const s = S.setStyle(base(), 0, "a1", 0, "negative");
    expect(S.getLog(s, 0).sets["a1-0"].done).toBe(true);
  });

  it("keeps a rep count already logged when the style is set after", () => {
    let s = S.toggleSet(base(), 0, "a1", 0);
    s = S.setReps(s, 0, "a1", 0, 4);
    s = S.setStyle(s, 0, "a1", 0, "negative");
    expect(S.getLog(s, 0).sets["a1-0"]).toMatchObject({ reps: 4, style: "negative" });
  });

  it("carries style and assist weight into the log", () => {
    let s = base();
    const { exercises } = S.sessionFor(s, 0);
    const pull = exercises.find((e) => /pulldown|pull ups/i.test(e.name));
    s = S.setStyle(s, 0, pull.id, 0, "negative");
    const logged = S.finishSession(s, 0).history[0].exercises.find((e) => e.name === pull.name);
    expect(logged.sets[0]).toMatchObject({ done: true, style: "negative" });
  });

  it("leaves style null on ordinary sets", () => {
    const s = S.toggleSet(base(), 0, "main", 0);
    expect(S.finishSession(s, 0).history[0].exercises[0].sets[0].style).toBeNull();
  });
});
