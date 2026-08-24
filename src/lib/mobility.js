/* Mobility.

   The program says "before every workout make sure to foam roll and warm up
   properly" and links an upper and a lower warm-up video. This is that,
   written out, split the way the evidence supports: dynamic work before
   lifting, static holds after, and a short daily joint routine on off days.

   Deliberately absent: the sleeper stretch. It gets recommended constantly for
   shoulders and it compresses the front of a joint that's already unhappy.
   Not worth it here. */

export const MOB = {
  upper: {
    key: "upper",
    label: "Upper",
    pre: [
      { name: "Foam roll thoracic spine", dose: "8 slow extensions" },
      { name: "Band pull-aparts", dose: "2 × 15", note: "Light band. Stop short of a hard squeeze." },
      { name: "Wall slides", dose: "2 × 10", note: "Low back stays flat against the wall." },
      { name: "Scapular push-ups", dose: "2 × 10" },
      { name: "Shoulder CARs", dose: "3 each direction, each arm", note: "Slowest thing you'll do all day. This is the joint-health one." },
      { name: "Band external rotation", dose: "2 × 15", note: "Light. Elbow pinned to your side." },
    ],
    post: [
      { name: "Doorway pec stretch", dose: "45s each side" },
      { name: "Cross-body posterior cuff stretch", dose: "30s each side" },
      { name: "Overhead triceps stretch", dose: "30s each side" },
      { name: "Foam roll lats", dose: "60s each side" },
    ],
  },
  lower: {
    key: "lower",
    label: "Lower",
    pre: [
      { name: "Foam roll quads, glutes, IT band", dose: "60s each" },
      { name: "90/90 hip switches", dose: "10 each side" },
      { name: "Leg swings", dose: "10 front-back, 10 side-side" },
      { name: "Knee-to-wall ankle rocks", dose: "10 each side", note: "Ankles gate squat depth more often than hips do." },
      { name: "Bodyweight squat to hold", dose: "10 reps, hold the 3rd for 10s" },
      { name: "Glute bridges", dose: "2 × 15" },
    ],
    post: [
      { name: "Couch stretch", dose: "45s each side" },
      { name: "Seated hamstring stretch", dose: "45s each side" },
      { name: "Figure-4 glute stretch", dose: "45s each side" },
      { name: "Calf stretch on wall", dose: "30s each side" },
    ],
  },
  pull: {
    key: "pull",
    label: "Pull / hinge",
    pre: [
      { name: "Foam roll upper back and lats", dose: "60s each" },
      { name: "Cat-cow", dose: "10 slow" },
      { name: "Thoracic open-books", dose: "8 each side" },
      { name: "Dead hang", dose: "2 × 20-30s", note: "Skip it if the shoulder complains. Not worth it.", periscapular: true },
      { name: "Dowel hip hinge", dose: "10 reps", note: "Three points of contact the whole way down." },
      { name: "Glute bridges", dose: "2 × 15" },
    ],
    post: [
      { name: "Child's pose with lat reach", dose: "60s" },
      { name: "Thread the needle", dose: "45s each side" },
      { name: "Seated hamstring stretch", dose: "45s each side" },
      { name: "Doorway pec stretch", dose: "45s each side" },
    ],
  },
};

/* Off-day routine. Shoulder-priority, because that's the joint under threat.
   Low load done often beats hard stretching done occasionally — especially
   for something chronic, where the goal is capacity, not range. */
export const DAILY_JOINT = [
  { name: "Shoulder CARs", dose: "3 each direction, each arm", note: "Slow enough that it's boring." },
  { name: "Prone Y-T-W raises", dose: "2 × 8 each", note: "No weight, or 2.5 lb. Thumbs up. Stop at the first twinge." },
  { name: "Band external rotation", dose: "2 × 15 each arm" },
  { name: "Scapular wall slides", dose: "2 × 10", note: "Control the way down, not the way up." },
  { name: "Thoracic extension over foam roller", dose: "10 reps", note: "If the T-spine won't extend, the scapula pays for it." },
  { name: "Wrist CARs + flexor stretch", dose: "5 each direction, 30s hold", note: "You row and deadlift. Wrists take load." },
  { name: "Hip CARs", dose: "3 each direction, each side" },
  { name: "90/90 hip switches", dose: "10 each side" },
  { name: "Ankle CARs", dose: "5 each direction" },
  { name: "Deep squat hold", dose: "60s total, break it up if you need to" },
];

/* Isometric holds are the usual first line for a chronic periscapular problem:
   they load the tissue without the lengthening that tends to provoke it. */
export const PERISCAP_EXTRA = [
  { name: "Prone scapular retraction hold", dose: "5 × 10s", note: "Squeeze to about half effort, not maximal." },
  { name: "Isometric row hold against a band", dose: "5 × 15s each arm", note: "No movement. Just hold the position." },
  { name: "Supported single-arm hang (feet down)", dose: "3 × 20s", note: "Take most of your weight on your feet." },
];

export function mobilityFor(dayMobKey) {
  return MOB[dayMobKey] || MOB.upper;
}

export function mobilityCount(dayMobKey) {
  const m = mobilityFor(dayMobKey);
  return { pre: m.pre.length, post: m.post.length };
}
