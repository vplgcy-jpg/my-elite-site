# Saiyan Journal

A training journal for the **Saiyan Powerbuilding** program (Matthew Kido,
saiyanarmy.com), adapted for three days a week and for an ongoing right
periscapular injury.

Percentages, set/rep schemes, rest ranges and progression rules come from the
source program. Everything this app adds is marked ADAPTED in the code and
explained in the Guide tab.

## Running it

```bash
npm install
npm run dev      # local dev server
npm test         # 160 tests
npm run build    # production bundle
```

Storage uses `window.storage` when the app is hosted somewhere that provides it,
and falls back to `localStorage` everywhere else. No backend, no accounts.

## What it does

**Follows the program.** Phase 1 is 70% for 4×6, Phase 2 is 75% for 5×5,
Phase 3 is 80% for 7×4 — one week each, 21 days to a cycle. Speed sets drop
20% off the bar for 2×8-10. Working weights are computed from your training
max, with plate math per side.

**Logs what actually happened.** One tap marks a set at the prescribed reps,
which is most sets. Recording a short set is a second gesture, so the common
case stays a single tap and the deviation — the only part that carries
information — is what gets typed. Accessory weights are remembered per
exercise and shown as *last time: 180*.

**Times your rest.** Starts itself when you check off a set and picks the
length from context: 3:30 on percentage work, 1:30 on accessories. Elapsed
time is computed from a stored timestamp rather than a decrementing counter,
so it stays accurate when the phone locks. It can't alert you through a locked
screen — no web page can — but it keeps correct time in your pocket.

**Coaches progression.** After all three phases it reads what you logged and
recommends a training max change per lift, showing the numbers behind each call
and whether the rule came from the program or from the app. Clean cycle →
+5 lbs upper, +10 lower. One short rep → +5. Real failure → repeat at the same
weight. Two stalls → the deload week.

**Works around the injury.** Movements are tagged by which tissue they load, not
by which joint they're near. That distinction matters: face pulls and reverse
pec deck protect the *shoulder joint* and directly load the *periscapular*
tissue, so an app that only knows "shoulder problem" gives exactly the wrong
advice. Flagged movements are substituted for real alternatives that keep the
training effect — a day where four of five accessories are flagged is a day
that needs rewriting, not annotating. Deadlifts are configured to stay
conventional by explicit choice: flagged every session, never substituted.

**Includes the mobility work.** The program requires foam rolling and warming up
before every session and this is that, written out: dynamic work before
lifting, static holds after, and a daily joint routine for rest days.

## Layout

```
src/lib/program.js    program data, phases, session assembly, warm-up ramps
src/lib/coach.js      progression rules and their justifications
src/lib/injury.js     tissue-load tagging, substitutions, healing stages
src/lib/state.js      state shape, migration, session reducers
src/lib/storage.js    persistence — read failures never look like a fresh start
src/lib/mobility.js   warm-ups, cool-downs, off-day joint routine
src/lib/plates.js     plate math
src/components/       rest timer, set grid, plate bar, strength chart
src/GymJournal.jsx    views
test/                 160 tests
```

Logic lives in `src/lib` as pure functions, so the whole training model is
testable without rendering anything.

## Not medical advice

The injury layer is mechanical: it tags movements by tissue load and offers
substitutions. It doesn't diagnose anything. The source program's own screening
says to see a physician about any ongoing muscle or joint injury before running
it, and that still applies.
