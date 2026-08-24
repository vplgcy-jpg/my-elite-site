/* Injury layer.

   Not medical advice, and no substitute for a clinician. What it does is
   mechanical: tag every movement by how hard it loads an injured region,
   surface that where you're about to do it, and offer a swap you can decline.

   This resolves a real conflict in the earlier design, which treated face
   pulls and reverse pec deck as protective. That holds for a GLENOHUMERAL
   problem and is backwards for a PERISCAPULAR one — those movements are
   scapular retraction, which is exactly the tissue at SI14/SI15. Same
   shoulder, opposite advice. Region matters more than the word "shoulder". */

export const REGIONS = {
  periscapular: {
    label: "Periscapular",
    detail:
      "Rhomboids, levator scapulae, mid and upper trapezius — the medial border of the scapula. SI14 / SI15 sit over this.",
  },
  glenohumeral: {
    label: "Shoulder joint",
    detail: "The ball and socket itself: rotator cuff, labrum, anterior capsule.",
  },
  lowback: { label: "Low back", detail: "Lumbar spine and erectors." },
};

/* 3 = directly loads the tissue, 2 = meaningful demand, 1 = incidental. */
export const LOAD = {
  periscapular: {
    "Bent over rows": 3,
    "T bar rows": 3,
    "T bar row or low row machine": 3,
    "Face pulls": 3,
    "Reverse pec deck machine": 3,
    "Weighted pull ups": 3,
    "Weighted pull ups or machine pull ups": 3,
    "Pull ups (assisted ok)": 3,
    "1 arm dumbbell rows": 3,
    Deadlifts: 3,
    "Deadlifts (dynamic)": 2,
    "Romanian deadlifts": 2,
    "Romanian or stiff legged deadlifts": 2,
    "Lat pulldown": 2,
    "Close grip pull downs": 2,
    "Straight bar curls": 1,
    "Bench Press": 2,
    "Bench Press (dynamic)": 1,
    "DB shoulder press (light)": 2,
    "Dumbbell shoulder press": 2,
    "Overhead Press": 2,
    "Side lateral raises": 2,
    "Cable or dumbbell side lateral raises": 2,
    "Weighted dips": 2,
    Squats: 2,
    "Squats (dynamic)": 1,
    "Incline dumbbell bench": 1,
    "Close grip bench": 1,
  },
  glenohumeral: {
    "Weighted dips": 3,
    "Overhead Press": 3,
    "Dumbbell shoulder press": 3,
    "DB shoulder press (light)": 2,
    "Bench Press": 2,
    "Incline dumbbell bench": 2,
    "Close grip bench": 2,
    "Weighted pull ups": 2,
    "Cable or machine chest flys": 2,
    "Side lateral raises": 2,
    "Cable or dumbbell side lateral raises": 2,
    "Face pulls": 1,
  },
  lowback: {
    Deadlifts: 3,
    "Bent over rows": 3,
    "Romanian deadlifts": 3,
    "Romanian or stiff legged deadlifts": 3,
    "T bar rows": 2,
    Squats: 2,
    Lunges: 2,
  },
};

/* Swaps that keep the training effect and take load off the region. */
export const SWAP = {
  periscapular: {
    "Bent over rows": "Chest-supported row — the pad takes the isometric load off your upper back.",
    "T bar rows": "Chest-supported row, or a machine row with a chest pad.",
    "T bar row or low row machine": "Seated low row, light, no lean-back.",
    "Face pulls": "Band only and very light, or skip while symptomatic. This is direct retraction.",
    "Reverse pec deck machine": "Skip while symptomatic — same reason as face pulls.",
    "Weighted pull ups": "Neutral-grip lat pulldown. Don't hang dead at the bottom.",
    "Weighted pull ups or machine pull ups": "Assisted or machine, neutral grip, no full hang.",
    "Pull ups (assisted ok)": "Neutral-grip lat pulldown instead of hanging.",
    "1 arm dumbbell rows": "Chest-supported single-arm. Load the left normally, the right by feel.",
    Deadlifts: "Trap bar from blocks — same hinge, far less upper-back isometric demand.",
    "Lat pulldown": "Neutral grip, stop at the collarbone, no shrug at the bottom.",
    "Close grip pull downs": "Neutral grip, shorter range.",
  },
  glenohumeral: {
    "Weighted dips": "Skip. Nothing here is worth an anterior capsule.",
    "Overhead Press": "Landmine press or high-incline dumbbell press.",
    "Dumbbell shoulder press": "Landmine press, or light neutral-grip to a lower end range.",
    "DB shoulder press (light)": "Landmine press if it pinches at all.",
  },
  lowback: {
    Deadlifts: "Trap bar, or rack pulls from just below the knee.",
    "Bent over rows": "Chest-supported row.",
    "Romanian deadlifts": "Lying or seated hamstring curl.",
  },
};

/* Healing stage gates how much load the region should see, and caps
   working percentages. maxLoad is the highest tier allowed through clean. */
export const STAGES = {
  acute: {
    key: "acute", label: "Acute", blurb: "Painful day to day. Recent, or currently flared.",
    maxLoad: 0, tmCapPct: 0.6,
    note: "Nothing that directly loads the region. Working weights capped at 60%.",
  },
  healing: {
    key: "healing", label: "Healing", blurb: "Improving. Sore under load, quiet at rest.",
    maxLoad: 1, tmCapPct: 0.85,
    note: "Swaps on for anything that pulls the scapula directly. Movements with incidental demand keep their prescribed weight and just get flagged.",
  },
  guarded: {
    key: "guarded", label: "Guarded", blurb: "Functional. Flares if you're careless.",
    maxLoad: 2, tmCapPct: 1,
    note: "Full percentages. Direct retraction work stays light or swapped.",
  },
  clear: {
    key: "clear", label: "Cleared", blurb: "Healed and cleared. Tracking only.",
    maxLoad: 3, tmCapPct: 1,
    note: "Program as written. The region stays flagged so a flare shows up early.",
  },
};

export function loadFor(exName, injuries) {
  let load = 0;
  let injury = null;
  for (const inj of injuries || []) {
    if (inj.muted) continue;
    const l = (LOAD[inj.region] || {})[exName] || 0;
    if (l > load) {
      load = l;
      injury = inj;
    }
  }
  return { load, injury };
}

/* null when the movement is fine as written. Otherwise what to do about it.
   An exercise listed in injury.keep is flagged but never swapped — that's the
   "I know, I'm doing it anyway" case, and it stays visible on purpose. */
export function injuryFlag(exName, injuries) {
  const { load, injury } = loadFor(exName, injuries);
  if (!injury || load === 0) return null;
  const stage = STAGES[injury.stage] || STAGES.guarded;
  if (load <= stage.maxLoad) return null;
  const kept = (injury.keep || []).includes(exName);
  return {
    injury,
    region: REGIONS[injury.region],
    stage,
    load,
    kept,
    severity: kept ? "watch" : load >= 3 ? "avoid" : "caution",
    swap: kept ? null : (SWAP[injury.region] || {})[exName] || null,
  };
}

/* Stage can cap the working percentage regardless of what the phase says. */
export function cappedWeight(weight, injuries, exName) {
  const { load, injury } = loadFor(exName, injuries);
  /* Only movements that load the tissue DIRECTLY get their weight reduced.
     Capping incidental-demand lifts compounds against the phase percentage —
     an 85% cap on Phase 3 bench is 0.80 x 0.85 = 68% of TM, below where Phase 1
     started, so the lift could never progress. Those get a flag, not a haircut. */
  if (!injury || load < 3) return { weight, capped: false };
  const stage = STAGES[injury.stage] || STAGES.guarded;
  if (stage.tmCapPct >= 1 || (injury.keep || []).includes(exName))
    return { weight, capped: false };
  const c = Math.round((weight * stage.tmCapPct) / 5) * 5;
  return c < weight ? { weight: c, capped: true, from: weight } : { weight, capped: false };
}

/* Default for this user: chronic right periscapular, managed not acute,
   deadlifts kept conventional by explicit choice. */
export const DEFAULT_INJURIES = [
  {
    id: "periscap-r",
    region: "periscapular",
    side: "right",
    label: "Right periscapular (SI14 / SI15)",
    stage: "healing",
    since: "age 18",
    keep: ["Deadlifts", "Deadlifts (dynamic)"],
    muted: false,
  },
];

/* Real substitutions, not just advice.

   Flagging four of five accessories tells you what not to do and leaves you
   without a workout. These are the movements that replace them: same training
   effect, same position in the session, load taken off the injured tissue. */
export const SUBSTITUTE = {
  periscapular: {
    "T bar rows": { name: "Chest-supported row", note: "The pad carries the isometric load your upper back would." },
    "Bent over rows": { name: "Chest-supported row", note: "Same pull, no spinal or scapular bracing." },
    "T bar row or low row machine": { name: "Seated low row (no lean-back)", note: "Keep your torso still — the row comes from the arms." },
    "1 arm dumbbell rows": { name: "Chest-supported single-arm row", note: "Load the left normally. Right side by feel." },
    "Weighted pull ups": { name: "Neutral-grip lat pulldown", note: "No dead hang at the bottom." },
    "Weighted pull ups or machine pull ups": { name: "Neutral-grip lat pulldown", note: "No dead hang at the bottom." },
    "Pull ups (assisted ok)": { name: "Neutral-grip lat pulldown", note: "No dead hang at the bottom." },
    "Lat pulldown": { name: "Neutral-grip lat pulldown", note: "Stop at the collarbone. No shrug at the bottom." },
    "Close grip pull downs": { name: "Neutral-grip lat pulldown", note: "Shorter range than usual." },
    /* Retraction volume comes out; low-load isometric and cuff work goes in.
       That is the standard direction for a periscapular tear, and it keeps
       the upper back doing something rather than nothing. */
    "Face pulls": { name: "Band external rotation", sets: 3, reps: "15", note: "Elbow pinned to your side. Light." },
    "Reverse pec deck machine": { name: "Isometric band row hold", sets: 3, reps: "15s", note: "No movement. Hold at about half effort." },
  },
  glenohumeral: {
    "Weighted dips": { name: "Close grip bench", sets: 4, reps: "8", note: "Same triceps work, no anterior capsule." },
    "Overhead Press": { name: "Landmine press", note: "Angled press instead of straight overhead." },
    "Dumbbell shoulder press": { name: "Landmine press", note: "Angled press instead of straight overhead." },
    "DB shoulder press (light)": { name: "Landmine press", note: "Angled press instead of straight overhead." },
  },
};

/* Swap out every flagged movement in an exercise list. Anything you chose to
   keep, and anything unflagged, passes through untouched. */
export function adaptExercises(exercises, injuries) {
  return exercises.map((ex) => {
    const flag = injuryFlag(ex.name, injuries);
    if (!flag || flag.kept || flag.severity !== "avoid") return ex;
    const sub = (SUBSTITUTE[flag.injury.region] || {})[ex.name];
    if (!sub) return ex;
    return {
      ...ex,
      name: sub.name,
      targetSets: sub.sets ?? ex.targetSets,
      targetReps: sub.reps ?? ex.targetReps,
      note: sub.note,
      substitutedFrom: ex.name,
    };
  });
}

/* How disrupted a session is as written — drives whether adapting is offered
   as a suggestion or turned on by default. */
export function adaptationNeed(exercises, injuries) {
  const flagged = exercises.filter((e) => {
    const f = injuryFlag(e.name, injuries);
    return f && !f.kept && f.severity === "avoid";
  });
  return {
    count: flagged.length,
    names: flagged.map((e) => e.name),
    /* Half a session flagged is a session that needs rewriting, not annotating. */
    recommended: flagged.length >= 2,
  };
}

/* Injury profiles that can be switched on. The periscapular one is configured;
   the others are here because a lifter often has more than one thing going on
   and inventing a second diagnosis on their behalf would be worse than asking. */
export const ADDABLE = [
  {
    id: "glenohumeral",
    region: "glenohumeral",
    label: "Shoulder joint (cuff / labrum / capsule)",
    hint: "Turn this on if the pain is in the joint itself rather than between the shoulder blade and spine. It's what flags weighted dips and heavy overhead press.",
    stage: "healing",
    keep: [],
    muted: false,
  },
  {
    id: "lowback",
    region: "lowback",
    label: "Low back",
    hint: "Flags heavy hinging — deadlifts, bent-over rows, RDLs.",
    stage: "healing",
    keep: [],
    muted: false,
  },
];
