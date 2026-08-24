/* Coach.

   Rule-based and auditable on purpose. Every recommendation carries the
   numbers behind it and whether the rule came from the program or from me,
   so you can disagree on the evidence rather than guess what it's doing. */

import { PHASES, LIFT_STEP, LIFT_LABEL, PROGRAMS, round5, e1rm } from "./program.js";

export const SRC = "Saiyan program";
export const MINE = "Coach";

/* Roll one cycle's logged sessions into per-lift performance. */
export function liftStats(history, cycle, liftKey) {
  const sessions = (history || []).filter(
    (h) => h.cycle === cycle && h.mainLift === liftKey && Array.isArray(h.exercises)
  );
  const phases = new Set();
  let prescribed = 0, performed = 0, missedSets = 0,
      hardSets = 0, doneSets = 0, topWeight = 0, best1rm = 0;

  for (const s of sessions) {
    const main = s.exercises.find((e) => e.kind === "main");
    if (!main) continue;
    phases.add(s.phase);
    topWeight = Math.max(topWeight, main.weight || 0);
    const target = Number(main.targetReps) || 0;
    prescribed += (main.targetSets || 0) * target;
    for (const set of main.sets || []) {
      if (!set.done) continue;
      doneSets += 1;
      const r = set.reps == null ? target : set.reps;
      performed += r;
      if (r < target) missedSets += 1;
      if (set.hard) hardSets += 1;
      best1rm = Math.max(best1rm, e1rm(main.weight, r));
    }
  }
  return {
    sessions: sessions.length,
    phasesCovered: phases.size,
    prescribed, performed, missedSets, hardSets, doneSets, topWeight, best1rm,
    completion: prescribed ? performed / prescribed : 0,
  };
}

/* End-of-cycle call for one lift. */
export function recommendForLift(state, liftKey) {
  const stats = liftStats(state.history, state.cycle, liftKey);
  const tm = state.tm?.[liftKey] || 0;
  const repeats = state.repeats?.[liftKey] || 0;
  const step = LIFT_STEP[liftKey] || 5;
  const base = { lift: liftKey, label: LIFT_LABEL[liftKey], stats, tm, repeats };

  if (!tm)
    return { ...base, status: "no-max", delta: 0, headline: "No training max set", why: [] };

  if (stats.phasesCovered < PHASES.length)
    return {
      ...base, status: "in-progress", delta: 0,
      headline: `${stats.phasesCovered} of 3 phases logged`,
      why: [{ src: MINE, text: stats.phasesCovered === 0
        ? "Nothing logged for this lift yet this cycle."
        : `Phase ${stats.phasesCovered} done. I won't call a progression until all three are in.` }],
    };

  if (repeats >= 2)
    return {
      ...base, status: "deload", delta: 0, headline: "Run the deload week",
      why: [
        { src: MINE, text: `You've repeated this cycle ${repeats}× at ${tm} lbs. Two stalls is a recovery problem, not a willpower problem.` },
        { src: SRC, text: "Deload week: same workout, all weights decreased by 50%. Then restart Phase 1." },
      ],
    };

  if (stats.missedSets === 0 && stats.completion >= 0.999)
    return {
      ...base, status: "increase", delta: step, headline: `Add ${step} lbs → ${tm + step}`,
      why: [
        { src: SRC, text: "Training maxes increase by 5-10 lbs after all 3 phases are completed without failure." },
        { src: MINE, text: `Zero missed reps across ${stats.doneSets} working sets. ${
            step === 10 ? "Lower-body lifts take the top of that range." : "Upper-body lifts take the bottom of it." }` },
        stats.hardSets > 0
          ? { src: MINE, text: `${stats.hardSets} set${stats.hardSets === 1 ? "" : "s"} flagged hard. You earned the jump — don't expect next cycle to feel easier.` }
          : null,
      ].filter(Boolean),
    };

  if (stats.missedSets <= 1 && stats.completion >= 0.95)
    return {
      ...base, status: "increase-small", delta: 5, headline: `Add 5 lbs → ${tm + 5}`,
      why: [
        { src: SRC, text: "The program says repeat the cycle if you fail. One short rep isn't a failed cycle." },
        { src: MINE, text: `${stats.performed}/${stats.prescribed} prescribed reps (${Math.round(stats.completion * 100)}%), ${stats.missedSets} short set. Bottom of the range, not the top.` },
        { src: MINE, text: "If you'd rather repeat it, repeat it. That's never the wrong call in this program." },
      ],
    };

  return {
    ...base, status: "repeat", delta: 0, headline: `Repeat at ${tm}`,
    why: [
      { src: SRC, text: "If you do fail, re-do the cycle at the same training max." },
      { src: MINE, text: `${stats.missedSets} short set${stats.missedSets === 1 ? "" : "s"}, ${stats.performed}/${stats.prescribed} reps (${Math.round(stats.completion * 100)}%).` },
      { src: MINE, text: "Same weights, same everything. This is the program working, not you failing it." },
    ],
  };
}

export function coachReport(state) {
  const lifts = PROGRAMS[state.program]?.lifts || [];
  const perLift = lifts.map((l) => recommendForLift(state, l));
  const actionable = perLift.filter(
    (r) => r.status !== "in-progress" && r.status !== "no-max"
  );
  return {
    perLift,
    ready: actionable.length > 0 && actionable.length === perLift.filter(r => r.status !== "no-max").length,
    anyDeload: perLift.some((r) => r.status === "deload"),
  };
}

/* Apply the coach's calls to state. Lifts that repeat get their counter bumped;
   lifts that progress reset it. Deload sends the whole cycle to the -50% week. */
export function applyRecommendations(state, report) {
  const tm = { ...state.tm };
  const repeats = { ...(state.repeats || {}) };
  for (const r of report.perLift) {
    if (r.status === "increase" || r.status === "increase-small") {
      tm[r.lift] = tm[r.lift] + r.delta;
      repeats[r.lift] = 0;
    } else if (r.status === "repeat") {
      repeats[r.lift] = (repeats[r.lift] || 0) + 1;
    } else if (r.status === "deload") {
      repeats[r.lift] = 0;
    }
  }
  return {
    ...state,
    tm,
    repeats,
    phase: report.anyDeload ? 3 : 0,
    cycle: report.anyDeload ? state.cycle : state.cycle + 1,
    log: {},
  };
}

/* Mid-session: you came up short on a set. What now? */
export function inSessionAdvice(weight, target, actual) {
  const t = Number(target) || 0;
  const gap = t - actual;
  if (gap <= 0) return null;
  if (gap === 1)
    return { tone: "warn", drop: 0, text: "One rep short. Keep the weight, take the full rest, finish the sets." };
  return {
    tone: "fail",
    drop: round5(weight * 0.9),
    text: `${gap} reps short. The program says decrease the weight or keep it the same — never grind. Drop 10% for the sets you have left.`,
  };
}

/* Estimated 1RM per lift over time, for the progress graph. Uses the best
   single set of each session so a bad last set doesn't sink the point. */
export function strengthSeries(history, liftKey) {
  return (history || [])
    .filter((h) => h.mainLift === liftKey && Array.isArray(h.exercises))
    .map((h) => {
      const main = h.exercises.find((e) => e.kind === "main");
      if (!main) return null;
      const target = Number(main.targetReps) || 0;
      let best = 0;
      for (const s of main.sets || []) {
        if (!s.done) continue;
        best = Math.max(best, e1rm(main.weight, s.reps == null ? target : s.reps));
      }
      return best ? { date: h.date, cycle: h.cycle, phase: h.phase, e1rm: best, weight: main.weight } : null;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/* -------------------------------------------------------------- readiness

   The honest answer to "I want more volume" is not an argument, it's an
   instrument. This reads the last few sessions and says whether the work is
   landing or whether you're digging a hole. Missed reps and hard-flagged sets
   are the earliest signals that volume has outrun recovery — they show up well
   before a stalled cycle does, which is the whole point of watching them. */

export function readiness(state, window = 6) {
  const sessions = (state.history || []).filter((h) => Array.isArray(h.exercises)).slice(0, window);
  if (sessions.length < 2)
    return { status: "unknown", sessions: sessions.length, headline: "Not enough logged yet", why: [], metrics: null };

  let prescribed = 0, performed = 0, doneSets = 0, hardSets = 0, missedSets = 0, skipped = 0;
  for (const s of sessions) {
    skipped += Math.max(0, (s.setsTotal || 0) - (s.setsDone || 0));
    for (const ex of s.exercises) {
      const target = Number(ex.targetReps) || 0;
      if (!target) continue;
      prescribed += (ex.targetSets || 0) * target;
      for (const set of ex.sets || []) {
        if (!set.done) continue;
        doneSets += 1;
        const r = set.reps == null ? target : set.reps;
        performed += r;
        if (r < target) missedSets += 1;
        if (set.hard) hardSets += 1;
      }
    }
  }

  const completion = prescribed ? performed / prescribed : 0;
  const missRate = doneSets ? missedSets / doneSets : 0;
  const hardRate = doneSets ? hardSets / doneSets : 0;
  const skipRate = sessions.reduce((n, s) => n + (s.setsTotal || 0), 0);
  const abandonRate = skipRate ? skipped / skipRate : 0;

  /* Symptom levels over the same span — a rising joint is a recovery signal
     as much as a missed rep is. */
  const since = new Date(sessions[sessions.length - 1].date);
  const symp = (state.symptoms || []).filter((s) => new Date(s.date) >= since);
  const avgSymptom = symp.length ? symp.reduce((n, s) => n + (s.level || 0), 0) / symp.length : null;
  const flaring = avgSymptom != null && avgSymptom >= 3.5;

  const metrics = { sessions: sessions.length, completion, missRate, hardRate, abandonRate, avgSymptom };
  const why = [];
  let score = 0;

  if (missRate > 0.15) { score += 2; why.push({ src: MINE, text: `${Math.round(missRate * 100)}% of your completed sets came up short of the prescribed reps. Over 15% usually means the volume, not the weight.` }); }
  else if (missRate > 0.05) { score += 1; why.push({ src: MINE, text: `${Math.round(missRate * 100)}% of sets short. Worth watching, not worth acting on yet.` }); }

  if (abandonRate > 0.2) { score += 2; why.push({ src: MINE, text: `You're leaving ${Math.round(abandonRate * 100)}% of prescribed sets undone. Sessions you don't finish are the clearest sign the plan is longer than your day.` }); }

  if (hardRate > 0.4) { score += 1; why.push({ src: MINE, text: `${Math.round(hardRate * 100)}% of sets flagged hard. Some of that is the program working as intended — most of it isn't.` }); }

  if (flaring) { score += 2; why.push({ src: MINE, text: `Your shoulder is averaging ${avgSymptom.toFixed(1)}/5 over this span. That's the signal that outranks the others.` }); }

  if (score === 0) why.push({ src: MINE, text: `${Math.round(completion * 100)}% of prescribed reps across ${sessions.length} sessions, few short sets. Whatever you're doing is being absorbed. Keep going.` });

  /* Any signal firing at all is worth a watch — reporting "you're absorbing
     the work" in the same breath as "13% of your sets came up short" would
     make the headline contradict the numbers under it. */
  const status = score >= 3 ? "digging" : score >= 1 ? "watch" : "absorbing";
  return {
    status,
    sessions: sessions.length,
    metrics,
    headline:
      status === "digging" ? "The volume has outrun your recovery"
        : status === "watch" ? "Early warning signs"
          : "You're absorbing the work",
    why,
    /* Only offered, never applied. */
    suggestion:
      status === "digging"
        ? "Cut to the 3-day for one cycle, or take the deload week. Not because you can't handle it — because the log says it isn't landing."
        : status === "watch"
          ? "Hold here. Don't add anything for a cycle and see if the misses clear on their own."
          : null,
  };
}
