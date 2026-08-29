/* State shape, migration, and the reducers that mutate a session.

   Kept as pure functions so the whole training model is testable without
   rendering anything. */

import { PROGRAMS, buildSession, round5, REST } from "./program.js";
import { DEFAULT_INJURIES, adaptExercises, adaptationNeed } from "./injury.js";
import { dayKey, DEFAULT_TARGETS } from "./food.js";
import { applySwaps } from "./alternatives.js";

export const SCHEMA = 2;

export function newState(opts = {}) {
  return {
    v: SCHEMA,
    program: opts.program || "short3",
    tm: { bench: 0, squat: 0, deadlift: 0, ohp: 0, ...(opts.tm || {}) },
    phase: 0,
    cycle: 1,
    repeats: {},
    log: {},
    history: [],
    lastWeights: {},
    symptoms: [],
    mobilityLog: {},
    swaps: {},
    food: {},
    customFoods: [],
    foodOverrides: {},
    targets: { ...DEFAULT_TARGETS },
    bodyweight: 175,
    injuries: opts.injuries || DEFAULT_INJURIES,
    settings: {
      restMain: REST.main,
      restDynamic: REST.dynamic,
      restAccessory: REST.accessory,
      sound: true,
      vibrate: true,
      showWarmups: true,
      adaptDay: true,
      bar: 45,
      ...(opts.settings || {}),
    },
  };
}

/* v1 stored a flat history row per session with only the main lift, and no
   per-exercise detail. Those rows are kept but marked so the coach ignores
   them rather than treating a missing rep count as a completed set. */
export function migrate(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.v === SCHEMA) return { ...newState(), ...raw, settings: { ...newState().settings, ...(raw.settings || {}) } };
  const base = newState({ tm: raw.tm, program: raw.program });
  return {
    ...base,
    phase: typeof raw.phase === "number" ? raw.phase : 0,
    cycle: typeof raw.cycle === "number" ? raw.cycle : 1,
    history: (raw.history || []).map((h) => ({
      date: h.date,
      day: h.day,
      cycle: h.cycle,
      phase: h.phase,
      mainLift: null,
      legacy: true,
      summary: h.mainLift ? `${h.mainLift} ${h.mainWeight} × ${h.mainSets}` : null,
      setsDone: h.setsDone,
      setsTotal: h.setsTotal,
      exercises: null,
    })),
  };
}

/* The one place a session is assembled. The training screen and the history
   writer both go through here, so what you tick is exactly what gets logged
   even when movements have been substituted. */
export function sessionFor(state, dayIdx) {
  const built = buildSession(state.program, dayIdx, state.phase, state.tm);
  const injuries = state.injuries || [];
  const need = adaptationNeed(built.exercises, injuries);
  const on = state.settings?.adaptDay !== false && need.count > 0;
  return {
    ...built,
    need,
    adapted: on,
    exercises: applySwaps(
      on ? adaptExercises(built.exercises, injuries) : built.exercises,
      state.swaps
    ),
  };
}

/* Swap an exercise for one this gym actually has. Sticks until changed. */
export function swapExercise(state, from, to) {
  const swaps = { ...(state.swaps || {}) };
  if (!to || to === from) delete swaps[from];
  else swaps[from] = to;
  return { ...state, swaps };
}

export const sessionKey = (state, dayIdx) =>
  `c${state.cycle}p${state.phase}d${dayIdx}`;

export function getLog(state, dayIdx) {
  return state.log[sessionKey(state, dayIdx)] || { sets: {}, weights: {}, mobility: {} };
}

function writeLog(state, dayIdx, next) {
  return { ...state, log: { ...state.log, [sessionKey(state, dayIdx)]: next } };
}

/* One tap = hit the prescribed reps. Recording an actual count is a second,
   optional gesture, so the common case stays a single tap. */
export function toggleSet(state, dayIdx, exId, setIdx) {
  const log = getLog(state, dayIdx);
  const k = `${exId}-${setIdx}`;
  const cur = log.sets[k];
  const sets = { ...log.sets };
  if (cur?.done) delete sets[k];
  else sets[k] = { done: true, reps: null, hard: false };
  return writeLog(state, dayIdx, { ...log, sets });
}

export function setReps(state, dayIdx, exId, setIdx, reps) {
  const log = getLog(state, dayIdx);
  const k = `${exId}-${setIdx}`;
  const prev = log.sets[k] || { done: true, hard: false };
  return writeLog(state, dayIdx, {
    ...log,
    sets: { ...log.sets, [k]: { ...prev, done: true, reps } },
  });
}

/* How a set was done — full, assisted, or a negative. Only meaningful on
   pull-ups and dips, where the same exercise covers all three. */
export function setStyle(state, dayIdx, exId, setIdx, style, assistWeight) {
  const log = getLog(state, dayIdx);
  const k = `${exId}-${setIdx}`;
  const prev = log.sets[k] || { done: true, reps: null, hard: false };
  return writeLog(state, dayIdx, {
    ...log,
    sets: { ...log.sets, [k]: { ...prev, done: true, style, assist: assistWeight ?? prev.assist ?? null } },
  });
}

export function markHard(state, dayIdx, exId, setIdx, hard) {
  const log = getLog(state, dayIdx);
  const k = `${exId}-${setIdx}`;
  const prev = log.sets[k] || { done: true, reps: null };
  return writeLog(state, dayIdx, {
    ...log,
    sets: { ...log.sets, [k]: { ...prev, done: true, hard } },
  });
}

/* Accessory weight is per exercise, not per set — one number to change,
   remembered by exercise name so it survives reordering the program. */
export function setWeight(state, dayIdx, exId, exName, weight) {
  const log = getLog(state, dayIdx);
  const w = weight === "" || weight == null ? null : Number(weight);
  return {
    ...writeLog(state, dayIdx, { ...log, weights: { ...log.weights, [exId]: w } }),
    lastWeights: w ? { ...state.lastWeights, [exName]: w } : state.lastWeights,
  };
}

export function toggleMobility(state, dayIdx, phaseKey, idx) {
  const log = getLog(state, dayIdx);
  const k = `${phaseKey}-${idx}`;
  const mobility = { ...log.mobility };
  if (mobility[k]) delete mobility[k];
  else mobility[k] = true;
  return writeLog(state, dayIdx, { ...log, mobility });
}

export function countSets(exercises) {
  return exercises.reduce((s, e) => s + (e.targetSets || 0), 0);
}

export function countDone(log, exercises) {
  let n = 0;
  for (const e of exercises)
    for (let i = 0; i < e.targetSets; i++) if (log.sets[`${e.id}-${i}`]?.done) n += 1;
  return n;
}

/* Turn the in-progress log into a history entry with per-exercise detail.
   This is the shape the coach and the graph read; the old flat row could not
   answer "did you actually hit the reps". */
export function finishSession(state, dayIdx, now = new Date()) {
  const { day, exercises, adapted } = sessionFor(state, dayIdx);
  const log = getLog(state, dayIdx);
  const detail = exercises.map((e) => ({
    name: e.name,
    kind: e.kind,
    lift: e.lift || null,
    weight: e.kind === "accessory" ? log.weights[e.id] ?? state.lastWeights[e.name] ?? null : e.weight,
    targetSets: e.targetSets,
    targetReps: e.targetReps,
    substitutedFrom: e.substitutedFrom || null,
    sets: Array.from({ length: e.targetSets }, (_, i) => {
      const s = log.sets[`${e.id}-${i}`];
      return s
        ? { done: true, reps: s.reps, hard: !!s.hard, style: s.style || null, assist: s.assist ?? null }
        : { done: false, reps: null, hard: false, style: null, assist: null };
    }),
  }));
  const total = countSets(exercises);
  const done = countDone(log, exercises);
  const entry = {
    date: now.toISOString(),
    program: state.program,
    day: day.name,
    dayIdx,
    cycle: state.cycle,
    phase: state.phase,
    adapted,
    mainLift: day.main || null,
    exercises: detail,
    setsDone: done,
    setsTotal: total,
    mobilityPre: Object.keys(log.mobility || {}).some((k) => k.startsWith("pre-")),
    mobilityPost: Object.keys(log.mobility || {}).some((k) => k.startsWith("post-")),
  };
  const lastWeights = { ...state.lastWeights };
  for (const e of detail) if (e.kind === "accessory" && e.weight) lastWeights[e.name] = e.weight;

  const log2 = { ...state.log };
  delete log2[sessionKey(state, dayIdx)];

  return {
    ...state,
    lastWeights,
    history: [entry, ...(state.history || [])].slice(0, 500),
    log: log2,
  };
}

export function logSymptom(state, entry, now = new Date()) {
  return {
    ...state,
    symptoms: [{ date: now.toISOString(), ...entry }, ...(state.symptoms || [])].slice(0, 300),
  };
}

/* Which day to offer next, from what you actually did last. Removes a decision
   every session, and it's free — the history already knows. */
export function suggestNextDay(state) {
  const days = PROGRAMS[state.program].days;
  const last = (state.history || []).find((h) => h.program === state.program);
  if (!last || typeof last.dayIdx !== "number") return 0;
  return (last.dayIdx + 1) % days.length;
}

export function advancePhase(state) {
  return { ...state, phase: Math.min(2, state.phase + 1) };
}

export function endDeload(state) {
  return { ...state, phase: 0, cycle: state.cycle + 1, log: {} };
}

/* --------------------------------------------------------------- programs */

/* Switch between the 3-day adaptation and the 5-day program as written.
   History, maxes and symptom log all survive — a lift with no training max
   (overhead press, coming from the 3-day) routes itself to a test day. */
export function switchProgram(state, program) {
  if (!PROGRAMS[program] || program === state.program) return state;
  return { ...state, program, log: {} };
}

/* Bar weight is per lift, because it isn't always 45.
   A Smith machine bar is 15-25 lbs and its fixed path removes the stabiliser
   demand, so a Smith number is not a free-bar number. Changing the bar type
   invalidates the training max on purpose. */
export const BARS = {
  free: { label: "Free barbell", weight: 45 },
  smith: { label: "Smith machine", weight: 20 },
  trap: { label: "Trap bar", weight: 45 },
  dumbbell: { label: "Dumbbells", weight: 0 },
};

export function barFor(state, lift) {
  const b = state.bars?.[lift];
  if (!b) return { type: "free", weight: state.settings?.bar ?? 45 };
  return { type: b.type, weight: b.weight ?? BARS[b.type]?.weight ?? 45 };
}

export function setBar(state, lift, type, weight) {
  const prev = barFor(state, lift);
  const next = { type, weight: weight ?? BARS[type]?.weight ?? 45 };
  /* Only a change of TYPE invalidates the max. Correcting the weight of the
     same bar is just a measurement fix. */
  const invalidates = prev.type !== type;
  return {
    ...state,
    bars: { ...(state.bars || {}), [lift]: next },
    tm: invalidates ? { ...state.tm, [lift]: 0 } : state.tm,
    retestReason: invalidates
      ? { lift, from: BARS[prev.type]?.label || prev.type, to: BARS[type]?.label || type }
      : state.retestReason || null,
  };
}

/* Send one lift back to the test-day protocol without touching anything else. */
export function retestLift(state, lift) {
  return {
    ...state,
    tm: { ...state.tm, [lift]: 0 },
    repeats: { ...(state.repeats || {}), [lift]: 0 },
  };
}

export function clearRetestReason(state) {
  return { ...state, retestReason: null };
}

/* ------------------------------------------------------------------- food */

export function addFood(state, id, servings = 1, now = new Date()) {
  const key = dayKey(now);
  const day = state.food?.[key] || [];
  const existing = day.find((e) => e.id === id);
  const next = existing
    ? day.map((e) => (e.id === id ? { ...e, servings: e.servings + servings } : e))
    : [...day, { id, servings }];
  return { ...state, food: { ...(state.food || {}), [key]: next.filter((e) => e.servings > 0) } };
}

export function setServings(state, id, servings, now = new Date()) {
  const key = dayKey(now);
  const day = (state.food?.[key] || [])
    .map((e) => (e.id === id ? { ...e, servings } : e))
    .filter((e) => e.servings > 0);
  return { ...state, food: { ...(state.food || {}), [key]: day } };
}

export function foodToday(state, now = new Date()) {
  return state.food?.[dayKey(now)] || [];
}

/* A label that disagrees with the built-in number wins. */
export function overrideFood(state, id, patch) {
  return { ...state, foodOverrides: { ...(state.foodOverrides || {}), [id]: { ...(state.foodOverrides?.[id] || {}), ...patch } } };
}

export function addCustomFood(state, food) {
  const id = `custom-${(state.customFoods || []).length + 1}-${food.name.toLowerCase().replace(/\W+/g, "")}`;
  return { ...state, customFoods: [...(state.customFoods || []), { ...food, id, tags: ["custom"] }] };
}

export function setTargets(state, targets) {
  return { ...state, targets: { ...(state.targets || DEFAULT_TARGETS), ...targets } };
}
