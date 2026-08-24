/* Program data — Saiyan Powerbuilding (Matthew Kido / saiyanarmy.com).
   Percentages, set/rep schemes, rest ranges and progression rules are from
   that source. Deviations are marked ADAPTED and surfaced in the Guide. */

export const round5 = (n) => Math.round(n / 5) * 5;
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/* Epley. Sane up to ~10 reps, which covers everything this program logs. */
export const e1rm = (w, reps) =>
  !w || !reps || reps < 1 ? 0 : Math.round(w * (1 + reps / 30));

/* Source: P1 70% 4x6 (days 1-7), P2 75% 5x5 (8-14), P3 80% 7x4 (15-21). */
export const PHASES = [
  { key: 0, name: "Phase 1", pct: 0.7, sets: 4, reps: 6, week: 1 },
  { key: 1, name: "Phase 2", pct: 0.75, sets: 5, reps: 5, week: 2 },
  { key: 2, name: "Phase 3", pct: 0.8, sets: 7, reps: 4, week: 3 },
];

/* Source: "Do the same workout just decrease all weights by 50%." */
export const DELOAD = { key: 3, name: "Deload", pct: 0.35, sets: 4, reps: 6, week: 4 };

export const phaseAt = (i) => (i === 3 ? DELOAD : PHASES[i]);

/* Source: "Drop weight by 20% and do 2 sets of 8-10 reps (Dynamic)" */
export const DYN = { pctOfWork: 0.8, sets: 2, reps: "8-10" };

/* Source: "2-5 mins on your heavy compound % based movements.
   And 1-2 mins on accessory exercises." Midpoints, adjustable in settings. */
export const REST = { main: 210, dynamic: 90, accessory: 90 };

export const LIFT_LABEL = {
  bench: "Bench Press",
  squat: "Squat",
  deadlift: "Deadlift",
  ohp: "Overhead Press",
};

/* Source says +5-10 lbs. Lower body takes the top of that range. */
export const LIFT_STEP = { bench: 5, ohp: 5, squat: 10, deadlift: 10 };
export const LIFT_START = { bench: 95, squat: 135, deadlift: 135, ohp: 65 };
export const LIFT_JUMP = { bench: 20, squat: 20, deadlift: 30, ohp: 10 };

const acc = (name, sets, reps, note) => ({ name, sets, reps, note, kind: "accessory" });

/* ---- 5-day, verbatim from the PDF. Days 3 and 7 are rest. ---- */
export const FULL_DAYS = [
  {
    id: "upper-power", name: "Upper Power", dayNo: 1,
    main: "bench", mainLabel: "Bench Press", mobility: "upper",
    accessories: [
      acc("T bar rows", 5, "5"),
      acc("Dumbbell shoulder press", 4, "10"),
      acc("Weighted pull ups or machine pull ups", 5, "5"),
      acc("Weighted dips", 4, "6-8"),
      acc("Dumbbell bicep curls", 5, "5"),
      acc("Reverse pec deck machine", 3, "10"),
    ],
  },
  {
    id: "lower-power", name: "Lower Power", dayNo: 2,
    main: "squat", mainLabel: "Squats", mobility: "lower",
    accessories: [
      acc("Romanian or stiff legged deadlifts", 3, "6-8"),
      acc("Single legged leg press", 4, "10", "Each leg. Start with the weaker leg."),
      acc("Lying hamstring curls", 4, "10"),
      acc("Standing calf raise machine", 4, "10", "Last set: drop set to failure."),
      acc("Seated calf machine", 3, "15"),
    ],
  },
  {
    id: "pull-hyp", name: "Pull Hypertrophy", dayNo: 4,
    main: null, mainLabel: null, mobility: "pull",
    accessories: [
      acc("Bent over rows", 4, "8"),
      acc("Weighted pull ups", 4, "8"),
      acc("T bar row or low row machine", 3, "12"),
      acc("Close grip pull downs", 3, "15"),
      acc("1 arm dumbbell rows", 3, "15"),
      acc("Straight bar curls", 3, "10"),
      acc("Dumbbell hammer curls", 3, "20"),
    ],
  },
  {
    id: "push-hyp", name: "Push Hypertrophy + Heavy Shoulders", dayNo: 5,
    main: "ohp", mainLabel: "Overhead Press", mobility: "upper",
    accessories: [
      acc("Incline dumbbell bench", 4, "10"),
      acc("Cable or dumbbell side lateral raises", 4, "20"),
      acc("Close grip bench", 3, "10"),
      acc("Cable or machine chest flys", 3, "15"),
      acc("Tricep pushdowns", 3, "20"),
      acc("Face pulls", 4, "15"),
    ],
  },
  {
    id: "lower-hyp", name: "Lower Hypertrophy + Heavy Deadlifts", dayNo: 6,
    main: "deadlift", mainLabel: "Deadlifts", mobility: "pull",
    accessories: [
      acc("Leg press superset", 3, "10+10", "10 close stance, then 10 wide stance."),
      acc("Lunges", 3, "20 steps"),
      acc("Leg extensions", 3, "20"),
      acc("Seated hamstring curl", 3, "20"),
      acc("Standing calf machine", 4, "10", "Last set: drop set to failure."),
      acc("Seated calf machine", 3, "20"),
    ],
  },
];

/* ---- 3-day ADAPTED. Same percentages and set/rep scheme, volume
   redistributed, glenohumeral-loading movements removed. ---- */
export const SHORT_DAYS = [
  {
    id: "upper-power", name: "Upper Power", dayNo: 1,
    main: "bench", mainLabel: "Bench Press", mobility: "upper",
    accessories: [
      acc("T bar rows", 4, "6"),
      acc("Pull ups (assisted ok)", 4, "6"),
      acc("Dumbbell bicep curls", 3, "8"),
      acc("Reverse pec deck machine", 3, "12"),
      acc("Face pulls", 3, "15"),
    ],
  },
  {
    id: "lower-power", name: "Lower Power", dayNo: 2,
    main: "squat", mainLabel: "Squats", mobility: "lower",
    accessories: [
      acc("Romanian deadlifts", 3, "8"),
      acc("Leg press", 3, "10"),
      acc("Lying hamstring curls", 3, "10"),
      acc("Leg extensions", 3, "15"),
      acc("Standing calf raise machine", 3, "12", "Last set: drop set to failure."),
    ],
  },
  {
    id: "pull-shoulders", name: "Pull + Shoulders", dayNo: 3,
    main: "deadlift", mainLabel: "Deadlifts", mobility: "pull",
    accessories: [
      acc("Bent over rows", 3, "8"),
      acc("DB shoulder press (light)", 3, "12", "ADAPTED — light only. Stop if it pinches."),
      acc("Lat pulldown", 3, "12"),
      acc("Side lateral raises", 3, "15"),
      acc("Dumbbell hammer curls", 3, "15"),
    ],
  },
];

export const PROGRAMS = {
  short3: {
    id: "short3",
    label: "3-day",
    blurb: "Three non-consecutive days. Same percentages, volume redistributed.",
    days: SHORT_DAYS,
    lifts: ["bench", "squat", "deadlift"],
    adapted: true,
  },
  full5: {
    id: "full5",
    label: "5-day",
    blurb: "The Saiyan program as written. Five training days, two rest days.",
    days: FULL_DAYS,
    lifts: ["bench", "squat", "deadlift", "ohp"],
    adapted: false,
  },
};

/* Source: superset back to back, 3 sets AMRAP, 2-3x/week. */
export const ABS = ["Hanging leg raises", "Ball crunches", "Bicycles"];

/* Build the full ordered exercise list for a session. */
export function buildSession(program, dayIdx, phaseIdx, tm) {
  const day = PROGRAMS[program].days[dayIdx];
  const ph = phaseAt(phaseIdx);
  const out = [];
  if (day.main && tm?.[day.main]) {
    const work = round5(tm[day.main] * ph.pct);
    out.push({
      id: "main", kind: "main", name: day.mainLabel, lift: day.main,
      weight: work, targetSets: ph.sets, targetReps: ph.reps, rest: REST.main,
    });
    out.push({
      id: "dyn", kind: "dynamic", name: `${day.mainLabel} (dynamic)`, lift: day.main,
      weight: round5(work * DYN.pctOfWork), targetSets: DYN.sets,
      targetReps: DYN.reps, rest: REST.dynamic,
    });
  }
  day.accessories.forEach((a, i) => {
    out.push({
      id: `a${i}`, kind: "accessory", name: a.name, note: a.note,
      targetSets: a.sets, targetReps: a.reps, rest: REST.accessory,
    });
  });
  return { day, phase: ph, exercises: out };
}

/* Warm-up ramp. The program says warm up properly but doesn't prescribe sets.
   Excluded from session totals so completion percentages stay meaningful. */
export function warmupSets(work, bar = 45) {
  if (!work || work <= bar) return [];
  const steps = [
    { pct: 0, reps: 10, label: "Empty bar" },
    { pct: 0.4, reps: 5 },
    { pct: 0.6, reps: 3 },
    { pct: 0.8, reps: 2 },
  ];
  const out = [];
  for (const s of steps) {
    const w = s.pct === 0 ? bar : round5(work * s.pct);
    if (w >= work) break;
    if (out.length && out[out.length - 1].weight === w) continue;
    out.push({ weight: w, reps: s.reps, label: s.label });
  }
  return out;
}
