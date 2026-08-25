/* Food.

   Built for one constraint: no fridge. Everything here is either eaten within
   ten minutes of cooking or lives in a car without spoiling.

   Numbers are per-serving averages for the common version of each item. Brands
   vary — a whey scoop especially — so every value is editable. What your label
   says wins over what this file says. */

export const DEFAULT_TARGETS = { cal: 2900, protein: 175 };

/* protein at 1g per lb of bodyweight, which is the top of what the evidence
   supports. Calories at a lean-bulk surplus over an estimated maintenance. */
export function targetsFor(bodyweight = 175, surplus = 300) {
  return {
    protein: Math.round(bodyweight),
    cal: Math.round((bodyweight * 14.9 + surplus) / 10) * 10,
  };
}

const f = (id, name, serving, cal, protein, carbs, fat, tags) =>
  ({ id, name, serving, cal, protein, carbs, fat, tags });

export const FOODS = [
  /* --- shelf stable, lives in the car --- */
  f("tuna", "Tuna pouch", "2.6 oz pouch", 80, 17, 0, 1, ["car", "protein"]),
  f("chickenpouch", "Chicken pouch", "2.6 oz pouch", 90, 16, 0, 2, ["car", "protein"]),
  f("sardines", "Sardines", "1 tin", 190, 23, 0, 11, ["car", "protein"]),
  f("whey", "Whey shake", "1 scoop", 120, 24, 3, 2, ["car", "protein"]),
  f("jerky", "Beef jerky", "1 oz", 80, 11, 5, 1, ["car", "protein"]),
  f("proteinbar", "Protein bar", "1 bar", 210, 20, 22, 7, ["car", "protein"]),
  f("pb", "Peanut butter", "2 tbsp", 190, 8, 7, 16, ["car"]),
  f("almonds", "Almonds", "1 oz", 165, 6, 6, 14, ["car"]),
  f("shelfmilk", "Shelf-stable milk", "8 oz box", 150, 8, 12, 8, ["car", "protein"]),
  f("ricecup", "Instant rice cup", "1 cup", 200, 4, 44, 1, ["car"]),
  f("oats", "Oats, dry", "1/2 cup", 150, 5, 27, 3, ["car"]),
  f("tortilla", "Flour tortilla", "1 large", 140, 4, 24, 4, ["car"]),
  f("bagel", "Bagel", "1", 250, 10, 48, 2, ["car"]),
  f("chili", "Canned chili", "1 can", 350, 18, 30, 17, ["car"]),
  f("banana", "Banana", "1 medium", 105, 1, 27, 0, ["car"]),
  f("trailmix", "Trail mix", "1/4 cup", 175, 5, 16, 11, ["car"]),

  /* --- cooked and eaten now --- */
  f("eggs2", "Eggs", "2 large", 140, 12, 1, 10, ["cook", "protein"]),
  f("eggs3", "Eggs", "3 large", 210, 19, 1, 15, ["cook", "protein"]),
  f("rotisserie", "Rotisserie chicken", "3 oz", 165, 25, 0, 7, ["cook", "protein"]),
  f("groundbeef", "Ground beef 85/15", "4 oz", 240, 21, 0, 17, ["cook", "protein"]),
  f("ramen", "Instant ramen", "1 pack", 380, 8, 52, 14, ["cook"]),
  f("ricecooked", "Rice, cooked", "1 cup", 205, 4, 45, 0, ["cook"]),
];

export const byId = (id, custom = [], overrides = {}) => {
  const base = FOODS.find((x) => x.id === id) || custom.find((x) => x.id === id);
  if (!base) return null;
  return { ...base, ...(overrides[id] || {}) };
};

/* Local calendar day, not UTC — a 10pm meal belongs to today, not tomorrow. */
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dayTotals(entries, custom = [], overrides = {}) {
  const t = { cal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const e of entries || []) {
    const food = byId(e.id, custom, overrides);
    if (!food) continue;
    const n = e.servings || 0;
    t.cal += food.cal * n;
    t.protein += food.protein * n;
    t.carbs += (food.carbs || 0) * n;
    t.fat += (food.fat || 0) * n;
  }
  for (const k in t) t[k] = Math.round(t[k]);
  return t;
}

export function remaining(totals, targets) {
  return {
    cal: targets.cal - totals.cal,
    protein: targets.protein - totals.protein,
  };
}

/* What to eat next, given what's left in the day. Ranked by how much of the
   remaining protein gap one serving closes without blowing the calorie budget. */
export function suggest(totals, targets, custom = [], overrides = {}, limit = 3) {
  const left = remaining(totals, targets);
  if (left.protein <= 0) return [];
  const pool = [...FOODS, ...custom].map((x) => ({ ...x, ...(overrides[x.id] || {}) }));
  return pool
    .filter((x) => x.protein >= 8)
    .map((x) => {
      /* Prefer protein per calorie, but penalise anything that would overshoot
         the calories still available. */
      const density = x.protein / Math.max(1, x.cal);
      const overshoot = left.cal > 0 ? Math.max(0, x.cal - left.cal) / Math.max(1, left.cal) : 1;
      return { food: x, score: density * (1 - Math.min(1, overshoot)) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.food);
}
