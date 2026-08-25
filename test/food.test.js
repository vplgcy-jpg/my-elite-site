import { describe, it, expect } from "vitest";
import { FOODS, byId, dayKey, dayTotals, remaining, suggest, targetsFor } from "../src/lib/food.js";
import * as S from "../src/lib/state.js";

describe("food library", () => {
  it("is entirely fridge-free", () => {
    // Every item either keeps in a car or gets eaten straight off the pan.
    expect(FOODS.every((f) => f.tags.includes("car") || f.tags.includes("cook"))).toBe(true);
  });
  it("gives every item a serving size, not just a number", () => {
    expect(FOODS.every((f) => f.serving && f.serving.length > 0)).toBe(true);
  });
  it("has no duplicate ids", () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
  });
  it("carries enough high-protein options to actually hit the target", () => {
    const dense = FOODS.filter((f) => f.protein >= 15);
    expect(dense.length).toBeGreaterThanOrEqual(6);
  });
});

describe("targets", () => {
  it("sets protein at one gram per pound", () => {
    expect(targetsFor(175).protein).toBe(175);
    expect(targetsFor(200).protein).toBe(200);
  });
  it("puts calories in a lean-bulk surplus", () => {
    const t = targetsFor(175);
    expect(t.cal).toBeGreaterThan(2700);
    expect(t.cal).toBeLessThan(3100);
  });
});

describe("dayTotals", () => {
  it("multiplies by servings", () => {
    const t = dayTotals([{ id: "whey", servings: 2 }]);
    expect(t.protein).toBe(48);
    expect(t.cal).toBe(240);
  });
  it("adds across items", () => {
    const t = dayTotals([{ id: "eggs3", servings: 1 }, { id: "tuna", servings: 2 }]);
    expect(t.protein).toBe(19 + 34);
  });
  it("is zero for an empty day", () => {
    expect(dayTotals([])).toEqual({ cal: 0, protein: 0, carbs: 0, fat: 0 });
    expect(dayTotals(undefined).protein).toBe(0);
  });
  it("ignores an unknown id instead of crashing", () => {
    expect(dayTotals([{ id: "nope", servings: 1 }]).cal).toBe(0);
  });
  it("respects a label override over the built-in number", () => {
    const over = { whey: { protein: 30, cal: 150 } };
    expect(dayTotals([{ id: "whey", servings: 1 }], [], over).protein).toBe(30);
  });
  it("counts a custom food", () => {
    const custom = [{ id: "c1", name: "Mine", serving: "1", cal: 100, protein: 20, carbs: 0, fat: 0, tags: ["custom"] }];
    expect(dayTotals([{ id: "c1", servings: 2 }], custom).protein).toBe(40);
  });
});

describe("remaining", () => {
  it("reports the gap", () => {
    const r = remaining({ cal: 900, protein: 100 }, { cal: 2900, protein: 175 });
    expect(r).toEqual({ cal: 2000, protein: 75 });
  });
  it("goes negative once you're over", () => {
    expect(remaining({ cal: 3000, protein: 200 }, { cal: 2900, protein: 175 }).protein).toBe(-25);
  });
});

describe("suggest", () => {
  const targets = { cal: 2900, protein: 175 };
  it("offers protein-dense options while there's a gap", () => {
    const out = suggest({ cal: 500, protein: 40 }, targets);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((f) => f.protein >= 8)).toBe(true);
  });
  it("stops once protein is met", () => {
    expect(suggest({ cal: 2000, protein: 180 }, targets)).toEqual([]);
  });
  it("won't push a big item when almost no calories remain", () => {
    const out = suggest({ cal: 2850, protein: 100 }, targets);
    expect(out.every((f) => f.cal <= 200)).toBe(true);
  });
  it("honours overrides when ranking", () => {
    const over = { tuna: { protein: 50 } };
    const out = suggest({ cal: 500, protein: 40 }, targets, [], over, 1);
    expect(out[0].id).toBe("tuna");
  });
});

describe("dayKey", () => {
  it("uses the local calendar day, so a late meal counts as today", () => {
    expect(dayKey(new Date(2026, 7, 25, 23, 30))).toBe("2026-08-25");
    expect(dayKey(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01");
  });
});

describe("logging food", () => {
  const now = new Date(2026, 7, 25, 12, 0);
  const base = () => S.newState();

  it("adds an item to today", () => {
    const s = S.addFood(base(), "tuna", 1, now);
    expect(S.foodToday(s, now)).toEqual([{ id: "tuna", servings: 1 }]);
  });
  it("stacks servings rather than duplicating the row", () => {
    let s = S.addFood(base(), "tuna", 1, now);
    s = S.addFood(s, "tuna", 1, now);
    expect(S.foodToday(s, now)).toEqual([{ id: "tuna", servings: 2 }]);
  });
  it("drops the row when servings reach zero", () => {
    let s = S.addFood(base(), "tuna", 1, now);
    s = S.setServings(s, "tuna", 0, now);
    expect(S.foodToday(s, now)).toEqual([]);
  });
  it("keeps days separate", () => {
    const d1 = new Date(2026, 7, 25);
    const d2 = new Date(2026, 7, 26);
    let s = S.addFood(base(), "tuna", 2, d1);
    s = S.addFood(s, "whey", 1, d2);
    expect(S.foodToday(s, d1)).toHaveLength(1);
    expect(S.foodToday(s, d2)).toHaveLength(1);
    expect(dayTotals(S.foodToday(s, d1)).protein).toBe(34);
  });
  it("stores a label correction without touching the shared library", () => {
    const s = S.overrideFood(base(), "whey", { protein: 30 });
    expect(s.foodOverrides.whey.protein).toBe(30);
    expect(byId("whey").protein).toBe(24);
    expect(byId("whey", [], s.foodOverrides).protein).toBe(30);
  });
  it("adds a custom food with a unique id", () => {
    let s = S.addCustomFood(base(), { name: "Gas station burrito", serving: "1", cal: 400, protein: 16 });
    s = S.addCustomFood(s, { name: "Chocolate milk", serving: "1 pint", cal: 320, protein: 16 });
    const ids = s.customFoods.map((f) => f.id);
    expect(new Set(ids).size).toBe(2);
    expect(s.customFoods[0].tags).toContain("custom");
  });
  it("lets targets be changed", () => {
    const s = S.setTargets(base(), { protein: 190 });
    expect(s.targets.protein).toBe(190);
    expect(s.targets.cal).toBe(2900);
  });
  it("defaults to his numbers", () => {
    expect(base().targets).toEqual({ cal: 2900, protein: 175 });
  });
});
