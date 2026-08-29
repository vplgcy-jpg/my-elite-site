/* Equipment swaps.

   Not every gym has every machine. Each entry lists movements that train the
   same thing well enough to run the program unchanged. Order is a preference,
   best first. Sets and reps carry over from whatever it replaces. */

export const ALTERNATIVES = {
  "Standing calf raise machine": [
    "Smith machine calf raise",
    "Dumbbell calf raise off a step",
    "Leg press calf press",
    "Single-leg calf raise holding a dumbbell",
  ],
  "Standing calf machine": [
    "Smith machine calf raise",
    "Dumbbell calf raise off a step",
    "Leg press calf press",
    "Single-leg calf raise holding a dumbbell",
  ],
  "Seated calf machine": [
    "Leg press calf press",
    "Seated dumbbell calf raise (weight on knees)",
    "Dumbbell calf raise off a step",
  ],
  "Leg press": ["Hack squat", "Goblet squat", "Walking lunges", "Bulgarian split squat"],
  "Leg press superset": ["Hack squat", "Goblet squat", "Walking lunges"],
  "Single legged leg press": ["Bulgarian split squat", "Walking lunges", "Step-ups"],
  "Leg extensions": ["Sissy squat", "Bulgarian split squat", "Goblet squat"],
  "Lying hamstring curls": ["Seated hamstring curl", "Nordic curl", "Romanian deadlifts"],
  "Seated hamstring curl": ["Lying hamstring curls", "Nordic curl", "Romanian deadlifts"],
  "T bar rows": ["Chest-supported row", "Dumbbell row", "Seated cable row", "Bent over rows"],
  "T bar row or low row machine": ["Seated cable row", "Chest-supported row", "Dumbbell row"],
  "Chest-supported row": ["Seated cable row", "Dumbbell row", "T bar rows"],
  "Bent over rows": ["Chest-supported row", "Dumbbell row", "Seated cable row"],
  "Reverse pec deck machine": ["Cable rear delt fly", "Dumbbell rear delt fly", "Band pull-apart"],
  "Face pulls": ["Band pull-apart", "Cable rear delt fly", "Dumbbell rear delt fly"],
  "Lat pulldown": ["Neutral-grip lat pulldown", "Assisted pull ups", "Straight-arm pulldown"],
  "Neutral-grip lat pulldown": ["Lat pulldown", "Assisted pull ups", "Dumbbell row"],
  "Close grip pull downs": ["Neutral-grip lat pulldown", "Assisted pull ups"],
  "Pull ups (assisted ok)": ["Assisted pull-up machine", "Lat pulldown", "Inverted row"],
  "Weighted pull ups": ["Assisted pull-up machine", "Lat pulldown", "Inverted row"],
  "Weighted pull ups or machine pull ups": ["Assisted pull-up machine", "Lat pulldown", "Inverted row"],
  "Cable or machine chest flys": ["Dumbbell fly", "Pec deck", "Cable crossover"],
  "Cable or dumbbell side lateral raises": ["Dumbbell lateral raise", "Cable lateral raise", "Machine lateral raise"],
  "Side lateral raises": ["Cable lateral raise", "Machine lateral raise"],
  "Tricep pushdowns": ["Overhead cable extension", "Skull crushers", "Dumbbell kickback"],
  "Incline dumbbell bench": ["Incline barbell bench", "Incline machine press", "Low-to-high cable fly"],
  "Dumbbell shoulder press": ["Landmine press", "Machine shoulder press", "Arnold press"],
  "DB shoulder press (light)": ["Landmine press", "Machine shoulder press"],
  "Romanian deadlifts": ["Dumbbell Romanian deadlift", "Good mornings", "Seated hamstring curl"],
  "Romanian or stiff legged deadlifts": ["Dumbbell Romanian deadlift", "Good mornings"],
  "Lunges": ["Walking lunges", "Bulgarian split squat", "Step-ups"],
  "Straight bar curls": ["EZ bar curl", "Dumbbell curl", "Cable curl"],
  "Dumbbell bicep curls": ["EZ bar curl", "Cable curl", "Straight bar curls"],
  "Dumbbell hammer curls": ["Cable rope hammer curl", "Dumbbell bicep curls"],
  "1 arm dumbbell rows": ["Chest-supported single-arm row", "Seated cable row"],
  "Weighted dips": ["Close grip bench", "Machine dip", "Bench dip"],
  "Close grip bench": ["Tricep pushdowns", "Skull crushers", "Machine dip"],
};

export const alternativesFor = (name) => ALTERNATIVES[name] || [];

/* Apply the lifter's saved swaps to a built session. Keyed on the name as
   shown, so a swap sits on top of any injury substitution rather than
   fighting it. */
export function applySwaps(exercises, swaps) {
  if (!swaps) return exercises;
  return exercises.map((ex) => {
    const to = swaps[ex.name];
    if (!to || to === ex.name) return ex;
    return { ...ex, name: to, swappedFrom: ex.name, note: null };
  });
}

/* Pull-ups and dips can be loaded, assisted, or done as negatives, and the
   weight means the opposite thing in the assisted case. */
export const ASSISTABLE = [
  "Pull ups (assisted ok)",
  "Weighted pull ups",
  "Weighted pull ups or machine pull ups",
  "Assisted pull-up machine",
  "Weighted dips",
  "Machine dip",
];

export const SET_STYLES = [
  { key: "full", label: "Full", hint: "Bodyweight or loaded, all the way up." },
  { key: "assist", label: "Assisted", hint: "Machine or band taking weight off you." },
  { key: "negative", label: "Negative", hint: "Jump or step to the top, lower as slowly as you can." },
];

export const isAssistable = (name) =>
  ASSISTABLE.includes(name) || /pull[- ]?up|chin[- ]?up|dip/i.test(name);
