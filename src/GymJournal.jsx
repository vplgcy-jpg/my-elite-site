import React, { useState, useEffect, useCallback } from "react";
import { C, card, bigBtn, ghostBtn, label as lbl, mono } from "./theme.js";
import * as S from "./lib/state.js";
import * as Store from "./lib/storage.js";
import {
  PROGRAMS, PHASES, DELOAD, phaseAt, buildSession, warmupSets, round5,
  LIFT_LABEL, LIFT_START, LIFT_JUMP, ABS,
} from "./lib/program.js";
import { coachReport, applyRecommendations, inSessionAdvice, strengthSeries, readiness, SRC } from "./lib/coach.js";
import { injuryFlag, cappedWeight, STAGES, REGIONS, DEFAULT_INJURIES, ADDABLE } from "./lib/injury.js";
import { mobilityFor, DAILY_JOINT, PERISCAP_EXTRA } from "./lib/mobility.js";
import { FOODS, byId, dayTotals, remaining, suggest, targetsFor } from "./lib/food.js";
import PlateBar from "./components/PlateBar.jsx";
import SetGrid from "./components/SetGrid.jsx";
import StrengthChart from "./components/StrengthChart.jsx";
import RestTimerBar, { useRestTimer } from "./components/RestTimer.jsx";

const TABS = [
  ["today", "Train"],
  ["food", "Food"],
  ["mobility", "Mobility"],
  ["coach", "Coach"],
  ["log", "Log"],
  ["more", "More"],
];

export default function GymJournal() {
  const [state, setState] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | setup | error
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [view, setView] = useState("today");
  const [dayIdx, setDayIdx] = useState(0);
  const [toast, setToast] = useState(null);
  const [undo, setUndo] = useState(null);

  const rest = useRestTimer(state?.settings || {});

  const boot = useCallback(async () => {
    setStatus("loading");
    const r = await Store.load();
    if (!r.ok) {
      /* A read failure is NOT a fresh start. Showing Setup here would let the
         next save overwrite everything. Offer a retry instead. */
      setLoadError(r);
      setStatus("error");
      return;
    }
    if (r.empty) {
      setStatus("setup");
      return;
    }
    const migrated = S.migrate(r.value);
    setState(migrated);
    setDayIdx(S.suggestNextDay(migrated));
    setStatus("ready");
  }, []);

  useEffect(() => { boot(); }, [boot]);

  const save = useCallback(async (next, opts = {}) => {
    setState(next);
    if (opts.undo) setUndo({ state: opts.undo, label: opts.undoLabel || "Undo" });
    const r = await Store.save(next);
    if (!r.ok) setSaveError(r.error);
    else setSaveError(null);
    if (opts.toast) setToast(opts.toast);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!undo) return undefined;
    const id = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(id);
  }, [undo]);

  if (status === "loading") return <Shell><div style={{ color: C.dim }}>Loading…</div></Shell>;

  if (status === "error")
    return (
      <Shell>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 10px" }}>Couldn't read your data</h1>
        <p style={{ color: C.dim, fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>
          {loadError?.corrupt
            ? "Your saved data is there but didn't parse. That usually means a partial write, not a loss."
            : "Storage didn't respond."}
        </p>
        <p style={{ color: C.warn, fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
          Not starting a new log — that would overwrite what's saved. Retry first.
        </p>
        <button onClick={boot} style={bigBtn}>Retry</button>
        {loadError?.corrupt && (
          <button
            onClick={() => { setStatus("setup"); }}
            style={{ ...ghostBtn, marginTop: 12 }}
          >
            Start over anyway — I accept losing the saved log
          </button>
        )}
        {loadError?.raw && (
          <details style={{ marginTop: 22 }}>
            <summary style={{ color: C.faint, fontSize: 12, cursor: "pointer" }}>Show raw saved data</summary>
            <pre style={{ fontSize: 10, color: C.faint, overflowX: "auto", background: C.panel, padding: 12, borderRadius: 8, marginTop: 8 }}>
              {String(loadError.raw).slice(0, 4000)}
            </pre>
          </details>
        )}
      </Shell>
    );

  if (status === "setup")
    return <Setup onDone={async (s) => { await save(s); setStatus("ready"); }} />;

  const program = PROGRAMS[state.program];

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "ui-sans-serif, system-ui, sans-serif", paddingBottom: rest.running ? 150 : 92 }}>
      {saveError && (
        <div role="alert" style={{ background: "rgba(248,113,113,0.14)", borderBottom: `1px solid ${C.fail}`, color: C.fail, padding: "10px 16px", fontSize: 12 }}>
          Last change didn't save. Your screen is ahead of your storage — don't close the app.
        </div>
      )}

      {view === "today" && (
        <Today state={state} save={save} dayIdx={dayIdx} setDayIdx={setDayIdx} rest={rest} setView={setView} />
      )}
      {view === "food" && <FoodView state={state} save={save} />}
      {view === "mobility" && <MobilityView state={state} save={save} dayIdx={dayIdx} />}
      {view === "coach" && <CoachView state={state} save={save} />}
      {view === "log" && <LogView state={state} save={save} />}
      {view === "more" && <MoreView state={state} save={save} program={program} />}

      {undo && (
        <div style={{ position: "fixed", bottom: rest.running ? 132 : 74, left: 12, right: 12, zIndex: 30, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, fontSize: 13, color: C.dim }}>{undo.label}</div>
          <button onClick={() => { save(undo.state); setUndo(null); }} style={{ background: "none", border: "none", color: C.steel, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>UNDO</button>
        </div>
      )}

      {toast && !undo && (
        <div role="status" style={{ position: "fixed", bottom: rest.running ? 132 : 74, left: 12, right: 12, zIndex: 30, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", fontSize: 13, color: C.dim }}>
          {toast}
        </div>
      )}

      <RestTimerBar {...rest} />

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: C.panel, borderTop: `1px solid ${C.line}`, zIndex: 25 }}>
        {TABS.map(([k, name]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            aria-current={view === k ? "page" : undefined}
            style={{
              flex: 1, padding: "16px 2px 18px", background: "none", border: "none",
              color: view === k ? C.steel : C.dim, fontSize: 10, fontWeight: 700,
              letterSpacing: "0.03em", textTransform: "uppercase", cursor: "pointer",
            }}
          >
            {name}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", padding: "48px 22px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ setup */
function Setup({ onDone }) {
  const [step, setStep] = useState("program");
  const [program, setProgram] = useState("short3");
  const [v, setV] = useState({ bench: "", squat: "", deadlift: "", ohp: "" });

  const lifts = PROGRAMS[program].lifts;

  const finish = (knows) => {
    const tm = {};
    for (const k of ["bench", "squat", "deadlift", "ohp"]) {
      const n = parseInt(v[k], 10);
      /* Clamp at bar weight — round5(5 - 10) is a negative training max, and
         every working weight downstream inherits the nonsense. */
      tm[k] = knows && Number.isFinite(n) && n > 0 ? Math.max(45, round5(n - 10)) : 0;
    }
    onDone(S.newState({ program, tm, injuries: DEFAULT_INJURIES }));
  };

  return (
    <Shell>
      <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
        {step === "program" ? "Pick your week" : "Set up your lifts"}
      </h1>

      {step === "program" && (
        <>
          <p style={{ color: C.dim, fontSize: 15, lineHeight: 1.6, margin: "0 0 28px" }}>
            Saiyan is written as five days. Three is the adapted version — same percentages, volume redistributed.
          </p>
          {Object.values(PROGRAMS).map((p) => (
            <button
              key={p.id}
              onClick={() => { setProgram(p.id); setStep("maxes"); }}
              style={{ ...card, width: "100%", textAlign: "left", cursor: "pointer", display: "block" }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                {p.label} {p.adapted && <span style={{ fontSize: 11, color: C.warn }}>ADAPTED</span>}
              </div>
              <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>{p.blurb}</div>
            </button>
          ))}
        </>
      )}

      {step === "maxes" && (
        <>
          <p style={{ color: C.dim, fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" }}>
            Enter the heaviest weight you can do <strong style={{ color: C.text }}>3 clean reps</strong> with.
            We subtract 10 lbs to get your training max — the program says to start lighter on purpose.
          </p>
          {lifts.map((k) => (
            <div key={k} style={{ marginBottom: 16 }}>
              <label htmlFor={`tm-${k}`} style={{ ...lbl, display: "block", marginBottom: 8 }}>{LIFT_LABEL[k]}</label>
              <input
                id={`tm-${k}`}
                type="number" inputMode="numeric" min="0"
                value={v[k]}
                onChange={(e) => setV({ ...v, [k]: e.target.value })}
                placeholder="lbs for 3 reps"
                style={{
                  width: "100%", padding: 15, fontSize: 22, fontWeight: 700,
                  background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10,
                  color: C.text, fontFamily: mono, boxSizing: "border-box",
                }}
              />
            </div>
          ))}
          <p style={{ fontSize: 12, color: C.faint, lineHeight: 1.6, margin: "0 0 18px" }}>
            Leave any blank and that lift gets a test day instead — the app walks you up to a number.
          </p>
          <button onClick={() => finish(true)} style={bigBtn}>Build my program</button>
          <button onClick={() => finish(false)} style={{ ...ghostBtn, marginTop: 12 }}>
            I don't know any of them — test everything
          </button>
          <button onClick={() => setStep("program")} style={{ ...ghostBtn, marginTop: 12, border: "none" }}>← Back</button>
        </>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ confirm */
function Confirm({ open, title, body, confirmLabel, danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div
      role="dialog" aria-modal="true" aria-label={title}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(8,10,14,0.78)", display: "flex", alignItems: "center", padding: 22 }}
    >
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 24, width: "100%" }}>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 14, color: C.dim, lineHeight: 1.7, marginBottom: 22 }}>{body}</div>
        <button onClick={onConfirm} style={{ ...bigBtn, background: danger ? C.warn : C.steel }}>{confirmLabel}</button>
        <button onClick={onCancel} style={{ ...ghostBtn, marginTop: 10 }}>Cancel</button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- train */
function Today({ state, save, dayIdx, setDayIdx, rest, setView }) {
  const [confirm, setConfirm] = useState(null);
  const [showWarm, setShowWarm] = useState(false);
  const program = PROGRAMS[state.program];
  const { day, phase, exercises, need, adapted } = S.sessionFor(state, dayIdx);
  const log = S.getLog(state, dayIdx);
  const total = S.countSets(exercises);
  const done = S.countDone(log, exercises);
  const needsTest = day.main && !state.tm[day.main];
  const mob = mobilityFor(day.mobility);
  const preDone = mob.pre.filter((_, i) => log.mobility[`pre-${i}`]).length;

  const onToggle = (ex, i) => {
    const wasDone = !!log.sets[`${ex.id}-${i}`]?.done;
    save(S.toggleSet(state, dayIdx, ex.id, i));
    if (!wasDone) rest.start(ex.rest, `${ex.name} — set ${i + 1} of ${ex.targetSets} done`);
  };

  const finish = () => {
    const before = state;
    save(S.finishSession(state, dayIdx), {
      undo: before,
      undoLabel: `Logged ${day.name} — ${done}/${total} sets`,
    });
    rest.stop();
    setConfirm(null);
    setDayIdx((dayIdx + 1) % program.days.length);
  };

  const nextPhase = () => {
    const before = state;
    save(S.advancePhase(state), { undo: before, undoLabel: `Moved to ${phaseAt(Math.min(2, state.phase + 1)).name}` });
    setConfirm(null);
  };

  return (
    <div style={{ padding: "24px 18px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <div style={lbl}>Cycle {state.cycle} · {phase.name}</div>
        <div style={{ fontSize: 11, color: C.faint }}>
          {state.phase === 3 ? "Deload · 50% off" : `Week ${phase.week} of 3`}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 22, overflowX: "auto" }}>
        {program.days.map((d, i) => (
          <button
            key={d.id}
            onClick={() => setDayIdx(i)}
            aria-current={i === dayIdx ? "true" : undefined}
            style={{
              flex: "1 0 auto", padding: "10px 12px", fontSize: 11, fontWeight: 700,
              background: i === dayIdx ? C.steel : C.panel,
              color: i === dayIdx ? "#0B0E12" : C.dim,
              border: `1px solid ${i === dayIdx ? C.steel : C.line}`,
              borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {d.name}
          </button>
        ))}
      </div>

      <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 4px" }}>{day.name}</h2>
      <div style={{ fontSize: 12, color: C.faint, marginBottom: 20 }}>
        {done}/{total} sets · suggested next after your last session
      </div>

      <button
        onClick={() => setView("mobility")}
        style={{
          ...card, width: "100%", textAlign: "left", cursor: "pointer", display: "block",
          borderColor: preDone === mob.pre.length ? C.mob : C.line,
        }}
      >
        <div style={{ ...lbl, color: C.mob, marginBottom: 6 }}>Before you lift</div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          {mob.label} warm-up · {preDone}/{mob.pre.length} done
        </div>
        <div style={{ fontSize: 12, color: C.dim, marginTop: 4, lineHeight: 1.6 }}>
          The program says foam roll and warm up properly before every workout. Tap to open.
        </div>
      </button>

      {need.count > 0 && (
        <div style={{ ...card, borderColor: adapted ? C.mob : C.warn }}>
          <div style={{ ...lbl, color: adapted ? C.mob : C.warn, marginBottom: 6 }}>
            {adapted ? "Day adapted" : "Day not adapted"}
          </div>
          <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.7, marginBottom: 12 }}>
            {adapted
              ? `${need.count} movement${need.count === 1 ? "" : "s"} swapped for versions that keep the training effect and take load off your right periscapular. Same sets, same position in the session.`
              : `${need.count} of today's movements load your right periscapular directly. You'll see them flagged, unsubstituted.`}
          </div>
          <button
            onClick={() => save({ ...state, settings: { ...state.settings, adaptDay: !state.settings.adaptDay } })}
            style={{ ...ghostBtn, fontSize: 12, padding: 12 }}
          >
            {adapted ? "Show the day as written instead" : "Adapt the day for me"}
          </button>
        </div>
      )}

      {needsTest ? (
        <TestBlock lift={day.mainLabel} liftKey={day.main} state={state} save={save} />
      ) : (
        <>
          {exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              ex={ex}
              state={state}
              log={log}
              dayIdx={dayIdx}
              save={save}
              onToggle={(i) => onToggle(ex, i)}
              rest={rest}
              showWarm={showWarm}
              setShowWarm={setShowWarm}
            />
          ))}

          <div style={{ ...card, borderStyle: "dashed" }}>
            <div style={{ ...lbl, marginBottom: 8 }}>Abs · optional</div>
            <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.7 }}>
              {ABS.join(" → ")} — superset back to back, 3 rounds, as many reps as possible.
              2-3× a week, off days or after a session.
            </div>
          </div>

          <button
            onClick={() => setConfirm("finish")}
            disabled={done === 0}
            style={{ ...bigBtn, marginTop: 8, opacity: done === 0 ? 0.35 : 1, cursor: done === 0 ? "default" : "pointer" }}
          >
            Finish session · {done}/{total} sets
          </button>

          <button onClick={() => setConfirm("phase")} style={{ ...ghostBtn, marginTop: 12, marginBottom: 28 }}>
            {state.phase === 3
              ? "Deload done → start next cycle"
              : state.phase < 2
                ? `Finished ${phase.name} → ${PHASES[state.phase + 1].name}`
                : "Finished Phase 3 → see what the coach says"}
          </button>
        </>
      )}

      <Confirm
        open={confirm === "finish"}
        title="Log this session?"
        body={`${done} of ${total} sets. This writes it to your log and clears the checkmarks. You can undo straight after.`}
        confirmLabel="Log it"
        onConfirm={finish}
        onCancel={() => setConfirm(null)}
      />
      <Confirm
        open={confirm === "phase"}
        title={state.phase >= 2 ? "Phase 3 complete" : `Move to ${state.phase < 2 ? PHASES[state.phase + 1]?.name : ""}?`}
        danger
        body={
          state.phase === 3
            ? "Ends the deload and starts a fresh cycle at your current training maxes."
            : state.phase >= 2
              ? "That's all three phases. The coach reads what you actually logged and tells you what to do with each training max."
              : "Weights go up and reps come down from here. Anything unfinished in this phase stays unfinished."
        }
        confirmLabel={state.phase >= 2 ? "Open the coach" : "Next phase"}
        onConfirm={() => {
          if (state.phase === 3) { save(S.endDeload(state)); setConfirm(null); }
          else if (state.phase >= 2) { setConfirm(null); setView("coach"); }
          else nextPhase();
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

/* --------------------------------------------------------- exercise card */
function ExerciseCard({ ex, state, log, dayIdx, save, onToggle, showWarm, setShowWarm }) {
  const flag = injuryFlag(ex.name, state.injuries);
  const capped = ex.weight ? cappedWeight(ex.weight, state.injuries, ex.name) : { weight: null, capped: false };
  const weight = capped.weight;
  const lastWeight = state.lastWeights?.[ex.name];
  const logged = log.weights?.[ex.id];
  const numericTarget = Number(ex.targetReps) || null;

  /* Surface the coach the moment a set comes up short, not at the end. */
  let advice = null;
  if (numericTarget) {
    for (let i = 0; i < ex.targetSets; i++) {
      const s = log.sets[`${ex.id}-${i}`];
      if (s?.done && s.reps != null && s.reps < numericTarget) {
        advice = inSessionAdvice(weight || logged || lastWeight || 0, numericTarget, s.reps);
        break;
      }
    }
  }

  const bar = ex.lift ? S.barFor(state, ex.lift).weight : state.settings.bar;
  const warm = ex.kind === "main" && state.settings.showWarmups ? warmupSets(weight, bar) : [];

  return (
    <div
      data-exercise={ex.name}
      data-kind={ex.kind}
      style={{ ...card, borderColor: flag?.severity === "avoid" ? C.fail : C.line }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div>
          <div style={{ fontSize: ex.kind === "main" ? 17 : 16, fontWeight: 700 }}>{ex.name}</div>
          {ex.substitutedFrom && (
            <div style={{ fontSize: 11, color: C.mob, marginTop: 3 }}>
              swapped in for {ex.substitutedFrom}
            </div>
          )}
        </div>
        {ex.kind === "main" && (
          <div style={{ ...lbl, color: C.steel, fontSize: 10 }}>
            {Math.round((weight / (state.tm[ex.lift] || 1)) * 100)}% of TM
          </div>
        )}
      </div>

      {flag && <InjuryFlag flag={flag} />}

      {ex.kind !== "accessory" ? (
        <>
          <div style={{ fontSize: ex.kind === "main" ? 54 : 34, fontWeight: 800, lineHeight: 1.05, fontFamily: mono, letterSpacing: "-0.03em", margin: "10px 0 2px" }}>
            {weight}
            <span style={{ fontSize: ex.kind === "main" ? 18 : 14, color: C.dim, fontWeight: 600 }}> lbs</span>
          </div>
          {capped.capped && (
            <div style={{ fontSize: 11, color: C.warn, marginBottom: 6 }}>
              Capped from {capped.from} by your {flag?.stage.label.toLowerCase()} injury stage.
            </div>
          )}
          <div style={{ fontSize: 13, color: C.dim, marginBottom: 12 }}>
            {ex.targetSets} sets × {ex.targetReps} reps
            {ex.kind === "dynamic" && " · move it fast, never to failure"}
          </div>
          <div style={{ marginBottom: 14 }}><PlateBar total={weight} bar={bar} /></div>

          {ex.kind === "main" && warm.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <button
                onClick={() => setShowWarm(!showWarm)}
                aria-expanded={showWarm}
                style={{ background: "none", border: "none", color: C.faint, fontSize: 12, cursor: "pointer", padding: 0 }}
              >
                {showWarm ? "Hide warm-up ramp" : `Warm-up ramp · ${warm.length} sets — doesn't count toward your total`}
              </button>
              {showWarm && (
                <div style={{ marginTop: 10, borderLeft: `2px solid ${C.line}`, paddingLeft: 12 }}>
                  {warm.map((w, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.dim, padding: "5px 0" }}>
                      <span style={{ fontFamily: mono, color: C.text }}>{w.weight} lbs</span>
                      <span>× {w.reps}{w.label ? ` · ${w.label}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: C.dim, margin: "4px 0 12px" }}>
            {ex.targetSets} sets × {ex.targetReps} reps
          </div>
          {ex.note && <div style={{ fontSize: 12, color: C.steel, marginBottom: 12, lineHeight: 1.6 }}>{ex.note}</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <label htmlFor={`w-${ex.id}`} style={{ ...lbl, fontSize: 10 }}>Weight</label>
            <input
              id={`w-${ex.id}`}
              type="number" inputMode="numeric" min="0"
              value={logged ?? ""}
              placeholder={lastWeight ? String(lastWeight) : "—"}
              onChange={(e) => save(S.setWeight(state, dayIdx, ex.id, ex.name, e.target.value))}
              style={{
                width: 92, padding: "10px 12px", fontSize: 17, fontWeight: 700,
                background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8,
                color: C.text, fontFamily: mono,
              }}
            />
            {lastWeight ? (
              <div style={{ fontSize: 12, color: C.faint }}>last time: {lastWeight} lbs</div>
            ) : (
              <div style={{ fontSize: 12, color: C.faint }}>first time — pick one that makes the last rep hard</div>
            )}
          </div>
        </>
      )}

      <SetGrid
        exercise={ex}
        log={log}
        target={ex.targetReps}
        onToggle={onToggle}
        onReps={(i, reps) => save(S.setReps(state, dayIdx, ex.id, i, reps))}
        onHard={(i, hard) => save(S.markHard(state, dayIdx, ex.id, i, hard))}
      />

      {advice && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: advice.tone === "fail" ? "rgba(248,113,113,0.1)" : "rgba(251,191,36,0.1)", border: `1px solid ${advice.tone === "fail" ? C.fail : C.warn}` }}>
          <div style={{ ...lbl, fontSize: 10, color: advice.tone === "fail" ? C.fail : C.warn, marginBottom: 6 }}>Coach</div>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{advice.text}</div>
          {advice.drop > 0 && (
            <div style={{ fontSize: 13, color: C.dim, marginTop: 6, fontFamily: mono }}>→ {advice.drop} lbs</div>
          )}
        </div>
      )}
    </div>
  );
}

function InjuryFlag({ flag }) {
  const colour = flag.severity === "avoid" ? C.fail : flag.severity === "watch" ? C.steel : C.warn;
  const word = flag.severity === "avoid" ? "Avoid" : flag.severity === "watch" ? "Watching" : "Caution";
  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 8, border: `1px solid ${colour}`, background: "rgba(255,255,255,0.02)" }}>
      <div style={{ ...lbl, fontSize: 10, color: colour, marginBottom: 6 }}>
        {word} · {flag.injury.label}
      </div>
      {flag.kept ? (
        <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>
          You chose to keep this one as written. Loading it directly — log a symptom below if it bites.
        </div>
      ) : (
        <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>
          {flag.swap || flag.stage.note}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- test day */
function TestBlock({ lift, liftKey, state, save }) {
  const [val, setVal] = useState("");
  const n = parseInt(val, 10);
  const valid = Number.isFinite(n) && n >= 45;
  return (
    <div style={card}>
      <div style={{ ...lbl, color: C.steel, marginBottom: 10 }}>Test day</div>
      <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 12 }}>Find your {lift} max</div>
      <ol style={{ color: C.dim, fontSize: 14, lineHeight: 1.8, paddingLeft: 18, margin: "0 0 18px" }}>
        <li>Warm up first — the mobility tab has the ramp.</li>
        <li>Start at {LIFT_START[liftKey]} lbs. Do 3 reps.</li>
        <li>Add {LIFT_JUMP[liftKey]} lbs. Do 3 reps.</li>
        <li>Keep going until 3 reps is hard but the bar still moves clean.</li>
        <li>Stop there. Don't chase a failure.</li>
      </ol>
      <label htmlFor="test-val" style={{ ...lbl, display: "block", marginBottom: 8 }}>Heaviest clean 3 reps</label>
      <input
        id="test-val"
        type="number" inputMode="numeric" min="45"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="lbs"
        style={{
          width: "100%", padding: 15, fontSize: 21, fontWeight: 700, background: C.bg,
          border: `1px solid ${C.line}`, borderRadius: 10, color: C.text,
          fontFamily: mono, marginBottom: 12, boxSizing: "border-box",
        }}
      />
      <button
        onClick={() => save({ ...state, tm: { ...state.tm, [liftKey]: Math.max(45, round5(n - 10)) } })}
        disabled={!valid}
        style={{ ...bigBtn, opacity: valid ? 1 : 0.35, cursor: valid ? "pointer" : "default" }}
      >
        Lock it in{valid ? ` — TM ${Math.max(45, round5(n - 10))}` : ""}
      </button>
      <p style={{ fontSize: 12, color: C.faint, marginTop: 12, lineHeight: 1.6 }}>
        We subtract 10 lbs from what you enter. That's your training max, and every working weight comes from it.
        Starting under your true max is the point.
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- mobility */
function MobilityView({ state, save, dayIdx }) {
  const [tab, setTab] = useState("pre");
  const { day } = buildSession(state.program, dayIdx, state.phase, state.tm);
  const mob = mobilityFor(day.mobility);
  const log = S.getLog(state, dayIdx);
  const hasPeriscap = (state.injuries || []).some((i) => i.region === "periscapular" && !i.muted);

  const list = tab === "pre" ? mob.pre : tab === "post" ? mob.post : DAILY_JOINT;
  const isSession = tab === "pre" || tab === "post";

  return (
    <div style={{ padding: "24px 18px 0" }}>
      <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Mobility</h2>
      <p style={{ color: C.dim, fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
        The program says to foam roll and warm up before every workout. Dynamic work before you lift,
        static holds after, and a short joint routine on off days.
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[["pre", `Before · ${mob.label}`], ["post", "After"], ["daily", "Off days"]].map(([k, name]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              flex: 1, padding: "10px 6px", fontSize: 11, fontWeight: 700,
              background: tab === k ? C.mob : C.panel,
              color: tab === k ? "#0B0E12" : C.dim,
              border: `1px solid ${tab === k ? C.mob : C.line}`,
              borderRadius: 8, cursor: "pointer",
            }}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === "post" && (
        <p style={{ fontSize: 12, color: C.faint, lineHeight: 1.7, marginBottom: 16 }}>
          Static stretching belongs here, not before lifting — held stretches cut force output for a while afterwards.
        </p>
      )}
      {tab === "daily" && (
        <p style={{ fontSize: 12, color: C.faint, lineHeight: 1.7, marginBottom: 16 }}>
          8-10 minutes on rest days. For something chronic the goal is capacity, not range — low load done
          often beats hard stretching done occasionally.
        </p>
      )}

      {list.map((m, i) => {
        const key = `${tab}-${i}`;
        const checked = isSession && !!log.mobility[key];
        return (
          <button
            key={key}
            onClick={() => isSession && save(S.toggleMobility(state, dayIdx, tab, i))}
            style={{
              ...card, width: "100%", textAlign: "left", display: "block",
              cursor: isSession ? "pointer" : "default", padding: 16,
              borderColor: checked ? C.mob : C.line,
              background: checked ? "rgba(167,139,250,0.08)" : C.panel,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: checked ? C.mob : C.text }}>
                {isSession && (checked ? "✓ " : "")}{m.name}
              </div>
              <div style={{ fontSize: 12, color: C.dim, fontFamily: mono, whiteSpace: "nowrap" }}>{m.dose}</div>
            </div>
            {m.note && <div style={{ fontSize: 12, color: C.faint, marginTop: 6, lineHeight: 1.6 }}>{m.note}</div>}
          </button>
        );
      })}

      {tab === "daily" && hasPeriscap && (
        <div style={{ marginTop: 24 }}>
          <div style={{ ...lbl, color: C.mob, marginBottom: 10 }}>Periscapular — isometric add-ons</div>
          <p style={{ fontSize: 12, color: C.faint, lineHeight: 1.7, marginBottom: 14 }}>
            Isometrics are the usual first line for a chronic periscapular problem: they load the tissue
            without the lengthening that tends to provoke it. Add these to the routine above, not instead of it.
          </p>
          {PERISCAP_EXTRA.map((m, i) => (
            <div key={i} style={{ ...card, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{m.name}</div>
                <div style={{ fontSize: 12, color: C.dim, fontFamily: mono, whiteSpace: "nowrap" }}>{m.dose}</div>
              </div>
              {m.note && <div style={{ fontSize: 12, color: C.faint, marginTop: 6, lineHeight: 1.6 }}>{m.note}</div>}
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 30 }} />
    </div>
  );
}

/* -------------------------------------------------------------------- coach */
function CoachView({ state, save }) {
  const [confirm, setConfirm] = useState(false);
  const report = coachReport(state);

  const apply = () => {
    const before = state;
    save(applyRecommendations(state, report), {
      undo: before,
      undoLabel: report.anyDeload ? "Moved to deload week" : `Cycle ${state.cycle + 1} started`,
    });
    setConfirm(false);
  };

  return (
    <div style={{ padding: "24px 18px 0" }}>
      <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Coach</h2>
      <p style={{ color: C.dim, fontSize: 13, lineHeight: 1.7, marginBottom: 22 }}>
        Every call below shows the numbers behind it and where the rule came from, so you can disagree
        on the evidence instead of guessing what it's doing.
      </p>

      <ReadinessCard state={state} />

      {report.perLift.map((r) => (
        <div key={r.lift} style={{ ...card, borderColor: statusColour(r.status) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{r.label}</div>
            <div style={{ ...lbl, fontSize: 10, color: statusColour(r.status) }}>{statusWord(r.status)}</div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: mono, margin: "6px 0 12px", color: statusColour(r.status) }}>
            {r.headline}
          </div>

          {r.stats.prescribed > 0 && (
            <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
              <Stat n={`${r.stats.performed}/${r.stats.prescribed}`} l="reps hit" />
              <Stat n={`${Math.round(r.stats.completion * 100)}%`} l="completion" />
              <Stat n={r.stats.missedSets} l="short sets" />
              {r.stats.best1rm > 0 && <Stat n={r.stats.best1rm} l="best est. 1RM" />}
            </div>
          )}

          {r.why.map((w, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: w.src === SRC ? C.steel : C.faint, minWidth: 58, paddingTop: 2, fontWeight: 700 }}>
                {w.src === SRC ? "Program" : "Coach"}
              </div>
              <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6, flex: 1 }}>{w.text}</div>
            </div>
          ))}
        </div>
      ))}

      {report.ready && (
        <>
          <button onClick={() => setConfirm(true)} style={{ ...bigBtn, marginTop: 8 }}>
            {report.anyDeload ? "Start the deload week" : "Apply and start the next cycle"}
          </button>
          <p style={{ fontSize: 12, color: C.faint, lineHeight: 1.7, margin: "12px 0 30px" }}>
            You can undo this straight after, and you can always override a training max by hand under More.
          </p>
        </>
      )}
      {!report.ready && <div style={{ height: 30 }} />}

      <Confirm
        open={confirm}
        title={report.anyDeload ? "Start deload week?" : "Apply these and start cycle " + (state.cycle + 1) + "?"}
        body={
          report.anyDeload
            ? "Same workouts, all weights cut 50%. Then Phase 1 again at your current maxes."
            : report.perLift
                .filter((r) => r.status !== "no-max")
                .map((r) => `${r.label}: ${r.headline}`)
                .join(" · ")
        }
        confirmLabel={report.anyDeload ? "Start deload" : "Apply"}
        onConfirm={apply}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}

const Stat = ({ n, l }) => (
  <div>
    <div style={{ fontFamily: mono, fontSize: 17, fontWeight: 700 }}>{n}</div>
    <div style={{ fontSize: 10, color: C.faint, letterSpacing: "0.06em", textTransform: "uppercase" }}>{l}</div>
  </div>
);

const statusColour = (s) =>
  s === "increase" ? C.done : s === "increase-small" ? C.done : s === "repeat" ? C.warn : s === "deload" ? C.fail : C.line;
const statusWord = (s) =>
  ({ increase: "Progress", "increase-small": "Progress", repeat: "Hold", deload: "Deload", "in-progress": "Waiting", "no-max": "Not set" }[s] || s);

/* ---------------------------------------------------------------------- log */
function LogView({ state, save }) {
  const [tab, setTab] = useState("sessions");
  const [confirm, setConfirm] = useState(null);
  const h = state.history || [];
  const lifts = PROGRAMS[state.program].lifts;

  const remove = (i) => {
    const before = state;
    save({ ...state, history: h.filter((_, j) => j !== i) }, { undo: before, undoLabel: "Session deleted" });
    setConfirm(null);
  };

  return (
    <div style={{ padding: "24px 18px 0" }}>
      <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 16px" }}>Log</h2>

      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[["sessions", `Sessions · ${h.length}`], ["progress", "Progress"], ["symptoms", `Symptoms · ${(state.symptoms || []).length}`]].map(([k, name]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex: 1, padding: "10px 6px", fontSize: 11, fontWeight: 700,
            background: tab === k ? C.steel : C.panel, color: tab === k ? "#0B0E12" : C.dim,
            border: `1px solid ${tab === k ? C.steel : C.line}`, borderRadius: 8, cursor: "pointer",
          }}>{name}</button>
        ))}
      </div>

      {tab === "progress" && (
        <>
          <p style={{ fontSize: 12, color: C.faint, lineHeight: 1.7, marginBottom: 20 }}>
            Estimated 1RM from the reps you actually logged, not from your training max. A straight line
            here would just be your TM going up on schedule — this moves only when your performance does.
          </p>
          {lifts.map((l) => (
            <div key={l} style={card}>
              <StrengthChart points={strengthSeries(h, l)} label={LIFT_LABEL[l]} />
            </div>
          ))}
        </>
      )}

      {tab === "symptoms" && <SymptomLog state={state} save={save} />}

      {tab === "sessions" && (
        h.length === 0 ? (
          <p style={{ color: C.dim, fontSize: 14, lineHeight: 1.7 }}>
            Nothing logged yet. Check off sets on the Train tab, then Finish session and it lands here.
          </p>
        ) : (
          h.map((e, i) => {
            const full = e.setsDone >= e.setsTotal;
            const main = e.exercises?.find((x) => x.kind === "main");
            const shortSets = e.exercises
              ? e.exercises.reduce((n, x) => n + (x.sets || []).filter((s) => s.done && s.reps != null && s.reps < Number(x.targetReps)).length, 0)
              : 0;
            return (
              <div key={i} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{e.day}</div>
                  <div style={{ fontSize: 12, color: C.dim, fontFamily: mono }}>
                    {new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </div>
                {e.legacy ? (
                  <div style={{ fontSize: 13, color: C.faint }}>
                    {e.summary || "Older entry"} · no per-set detail (logged before rep tracking)
                  </div>
                ) : main ? (
                  <div style={{ fontSize: 13, color: C.dim, display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span>
                      {main.name}{" "}
                      <span style={{ color: C.text, fontFamily: mono, fontWeight: 700 }}>{main.weight}</span>{" "}
                      × {main.targetSets}×{main.targetReps}
                    </span>
                    <span style={{ color: full ? C.done : C.dim, fontSize: 12, fontWeight: 700 }}>
                      {e.setsDone}/{e.setsTotal}
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: C.dim }}>
                    Accessory day · {e.setsDone}/{e.setsTotal} sets
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ ...lbl, fontSize: 9 }}>Cycle {e.cycle} · {phaseAt(e.phase)?.name || `Phase ${e.phase + 1}`}</span>
                  {shortSets > 0 && <span style={{ fontSize: 10, color: C.warn, fontWeight: 700 }}>{shortSets} short</span>}
                  {e.mobilityPre && <span style={{ fontSize: 10, color: C.mob, fontWeight: 700 }}>warmed up</span>}
                  <button onClick={() => setConfirm(i)} style={{ marginLeft: "auto", background: "none", border: "none", color: C.faint, fontSize: 11, cursor: "pointer" }}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )
      )}
      <div style={{ height: 30 }} />

      <Confirm
        open={confirm !== null}
        title="Delete this session?"
        danger
        body="It comes out of your history and out of the coach's numbers. You can undo straight after."
        confirmLabel="Delete"
        onConfirm={() => remove(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function SymptomLog({ state, save }) {
  const [level, setLevel] = useState(2);
  const [note, setNote] = useState("");
  const entries = state.symptoms || [];

  const add = () => {
    save(S.logSymptom(state, { level, note: note.trim() || null }), { toast: "Symptom logged" });
    setNote("");
    setLevel(2);
  };

  return (
    <>
      <div style={card}>
        <div style={{ ...lbl, marginBottom: 10 }}>How's the shoulder today?</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setLevel(n)}
              aria-label={`Level ${n} of 5`}
              aria-pressed={level === n}
              style={{
                flex: 1, height: 46, borderRadius: 8, fontWeight: 700, fontFamily: mono, fontSize: 15,
                cursor: "pointer",
                border: `1px solid ${level === n ? levelColour(n) : C.line}`,
                background: level === n ? "rgba(255,255,255,0.05)" : "transparent",
                color: level === n ? levelColour(n) : C.dim,
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.faint, marginBottom: 14 }}>
          1 = quiet · 3 = noticeable under load · 5 = flared, back off
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What set it off? (optional)"
          aria-label="Symptom note"
          style={{
            width: "100%", padding: 13, fontSize: 14, background: C.bg,
            border: `1px solid ${C.line}`, borderRadius: 8, color: C.text,
            marginBottom: 12, boxSizing: "border-box",
          }}
        />
        <button onClick={add} style={bigBtn}>Log it</button>
      </div>

      <p style={{ fontSize: 12, color: C.faint, lineHeight: 1.7, marginBottom: 16 }}>
        Worth keeping for something chronic: over a few months this is what tells you which movements
        actually provoke it, rather than which ones you assume do.
      </p>

      {entries.map((e, i) => (
        <div key={i} style={{ ...card, padding: 14, display: "flex", gap: 12, alignItems: "baseline" }}>
          <div style={{ fontFamily: mono, fontSize: 19, fontWeight: 800, color: levelColour(e.level) }}>{e.level}</div>
          <div style={{ flex: 1 }}>
            {e.note && <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{e.note}</div>}
            <div style={{ fontSize: 11, color: C.faint, marginTop: e.note ? 4 : 0 }}>
              {new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

const levelColour = (n) => (n <= 2 ? C.done : n === 3 ? C.warn : C.fail);

/* --------------------------------------------------------------------- more */
function MoreView({ state, save, program }) {
  const [tab, setTab] = useState("maxes");
  return (
    <div style={{ padding: "24px 18px 0" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 22, overflowX: "auto" }}>
        {[["maxes", "Maxes"], ["program", "Program"], ["injury", "Injury"], ["settings", "Settings"], ["guide", "Guide"]].map(([k, n]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex: "1 0 auto", padding: "10px 14px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
            background: tab === k ? C.steel : C.panel, color: tab === k ? "#0B0E12" : C.dim,
            border: `1px solid ${tab === k ? C.steel : C.line}`, borderRadius: 8, cursor: "pointer",
          }}>{n}</button>
        ))}
      </div>
      {tab === "maxes" && <Maxes state={state} save={save} program={program} />}
      {tab === "program" && <ProgramPanel state={state} save={save} />}
      {tab === "injury" && <InjuryPanel state={state} save={save} />}
      {tab === "settings" && <Settings state={state} save={save} />}
      {tab === "guide" && <Guide state={state} />}
      <div style={{ height: 30 }} />
    </div>
  );
}

function Maxes({ state, save, program }) {
  const [confirm, setConfirm] = useState(null);
  const adjust = (k, d) =>
    save({ ...state, tm: { ...state.tm, [k]: Math.max(0, (state.tm[k] || 0) + d) } });
  return (
    <>
      <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Training maxes</h2>
      <p style={{ color: C.dim, fontSize: 13, lineHeight: 1.7, marginBottom: 22 }}>
        Every working weight comes from these. The coach moves them for you at the end of a cycle —
        this is the manual override.
      </p>
      {program.lifts.map((k) => (
        <div key={k} style={card}>
          <div style={{ ...lbl, marginBottom: 10 }}>{LIFT_LABEL[k]}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => adjust(k, -5)} aria-label={`${LIFT_LABEL[k]}: 5 pounds less`} style={stepBtn}>−</button>
            <div style={{ flex: 1, textAlign: "center", fontSize: 34, fontWeight: 800, fontFamily: mono }}>
              {state.tm[k] || "—"}
            </div>
            <button onClick={() => adjust(k, 5)} aria-label={`${LIFT_LABEL[k]}: 5 pounds more`} style={stepBtn}>+</button>
          </div>
          {state.tm[k] > 0 && (
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              {[...PHASES, DELOAD].map((p, i) => (
                <div key={i} style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: C.faint }}>
                    {p === DELOAD ? "Deload" : `P${i + 1}`}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 15, color: C.text, fontWeight: 700 }}>
                    {round5(state.tm[k] * p.pct)}
                  </div>
                  <div style={{ fontSize: 9, color: C.faint }}>{p.sets}×{p.reps}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
            <div style={{ ...lbl, fontSize: 9, marginBottom: 8 }}>What you lift it on</div>
            <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
              {Object.entries(S.BARS).filter(([t]) => t !== "dumbbell").map(([type, b]) => {
                const on = S.barFor(state, k).type === type;
                return (
                  <button
                    key={type}
                    onClick={() => on ? null : setConfirm({ lift: k, type })}
                    aria-pressed={on}
                    style={{
                      flex: 1, padding: "9px 4px", fontSize: 10, fontWeight: 700, borderRadius: 7,
                      cursor: on ? "default" : "pointer",
                      background: on ? C.steel : "transparent",
                      color: on ? "#0B0E12" : C.dim,
                      border: `1px solid ${on ? C.steel : C.line}`,
                    }}
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: C.faint, lineHeight: 1.6 }}>
              Bar weighs {S.barFor(state, k).weight} lbs — the plate math is built on that.
              {S.barFor(state, k).type === "smith" && " A Smith bar is lighter than a free bar and its fixed path does your stabilising for you, so this number won't transfer."}
            </div>
            {state.tm[k] > 0 && (
              <button
                onClick={() => setConfirm({ lift: k, retest: true })}
                style={{ ...ghostBtn, fontSize: 12, padding: 11, marginTop: 10 }}
              >
                Re-test this lift
              </button>
            )}
          </div>
        </div>
      ))}

      <Confirm
        open={confirm !== null}
        danger
        title={confirm?.retest ? `Re-test ${LIFT_LABEL[confirm.lift]}?` : "Change the bar?"}
        body={
          confirm?.retest
            ? "Clears the training max and gives you the test-day protocol next time this lift comes up. Your history stays."
            : confirm
              ? `Switching ${LIFT_LABEL[confirm.lift]} to a ${S.BARS[confirm.type].label.toLowerCase()} clears its training max, because a max on one bar isn't a max on another. You'll get a test day next time it comes up.`
              : ""
        }
        confirmLabel={confirm?.retest ? "Re-test it" : "Change it"}
        onConfirm={() => {
          const before = state;
          save(
            confirm.retest
              ? S.retestLift(state, confirm.lift)
              : S.setBar(state, confirm.lift, confirm.type),
            { undo: before, undoLabel: `${LIFT_LABEL[confirm.lift]} needs re-testing` }
          );
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

const stepBtn = {
  width: 48, height: 48, borderRadius: 10, border: `1px solid ${C.line}`,
  background: "transparent", color: C.text, fontSize: 22, fontWeight: 700, cursor: "pointer",
};

function InjuryPanel({ state, save }) {
  const injuries = state.injuries || [];
  const setStage = (id, stage) =>
    save({ ...state, injuries: injuries.map((i) => (i.id === id ? { ...i, stage } : i)) });
  const toggleMute = (id) =>
    save({ ...state, injuries: injuries.map((i) => (i.id === id ? { ...i, muted: !i.muted } : i)) });

  return (
    <>
      <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Injury</h2>
      <p style={{ color: C.dim, fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>
        This changes which movements get flagged and how heavy the directly-loading ones go. Move it as things change.
      </p>
      <p style={{ color: C.faint, fontSize: 12, lineHeight: 1.7, marginBottom: 22 }}>
        Mechanical, not medical. The program's own screening says to see a physician about any ongoing
        muscle or joint injury before running it — this doesn't replace that.
      </p>

      {injuries.map((inj) => (
        <div key={inj.id} style={card}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{inj.label}</div>
          <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.6, marginBottom: 6 }}>
            {REGIONS[inj.region]?.detail}
          </div>
          {inj.since && <div style={{ fontSize: 11, color: C.faint, marginBottom: 14 }}>Ongoing since {inj.since}</div>}

          <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
            {Object.values(STAGES).map((s) => (
              <button
                key={s.key}
                onClick={() => setStage(inj.id, s.key)}
                aria-pressed={inj.stage === s.key}
                style={{
                  flex: 1, padding: "9px 4px", fontSize: 10, fontWeight: 700, borderRadius: 7, cursor: "pointer",
                  background: inj.stage === s.key ? C.warn : "transparent",
                  color: inj.stage === s.key ? "#0B0E12" : C.dim,
                  border: `1px solid ${inj.stage === s.key ? C.warn : C.line}`,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.7, marginBottom: 12 }}>
            <strong style={{ color: C.text }}>{STAGES[inj.stage]?.blurb}</strong> {STAGES[inj.stage]?.note}
          </div>

          {inj.keep?.length > 0 && (
            <div style={{ fontSize: 12, color: C.steel, lineHeight: 1.7, marginBottom: 12 }}>
              Kept as written by your choice: {inj.keep.filter((k) => !k.includes("(")).join(", ")}. Flagged every
              session, never substituted.
            </div>
          )}

          <button onClick={() => toggleMute(inj.id)} style={{ ...ghostBtn, fontSize: 12, padding: 12 }}>
            {inj.muted ? "Un-mute flags" : "Mute flags for now"}
          </button>
        </div>
      ))}

      {ADDABLE.filter((a) => !injuries.some((i) => i.id === a.id)).map((a) => (
        <div key={a.id} style={{ ...card, borderStyle: "dashed" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{a.label}</div>
          <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.7, marginBottom: 14 }}>{a.hint}</div>
          <button
            onClick={() => save({ ...state, injuries: [...injuries, a] })}
            style={{ ...ghostBtn, fontSize: 12, padding: 12 }}
          >
            Add this one
          </button>
        </div>
      ))}
    </>
  );
}

function Settings({ state, save }) {
  const set = (k, v) => save({ ...state, settings: { ...state.settings, [k]: v } });
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const json = Store.exportJSON(state);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 22px" }}>Settings</h2>

      <div style={card}>
        <div style={{ ...lbl, marginBottom: 14 }}>Rest timers</div>
        {[
          ["restMain", "Main lift", "Program says 2-5 min"],
          ["restDynamic", "Speed sets", "Program says 1-2 min"],
          ["restAccessory", "Accessories", "Program says 1-2 min"],
        ].map(([k, name, hint]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
              <div style={{ fontSize: 11, color: C.faint }}>{hint}</div>
            </div>
            <button onClick={() => set(k, Math.max(15, state.settings[k] - 15))} aria-label={`${name}: 15 seconds less`} style={stepBtn}>−</button>
            <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, minWidth: 52, textAlign: "center" }}>
              {Math.floor(state.settings[k] / 60)}:{String(state.settings[k] % 60).padStart(2, "0")}
            </div>
            <button onClick={() => set(k, state.settings[k] + 15)} aria-label={`${name}: 15 seconds more`} style={stepBtn}>+</button>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ ...lbl, marginBottom: 14 }}>Alerts</div>
        {[["sound", "Beep when rest is up"], ["vibrate", "Vibrate when rest is up"], ["showWarmups", "Show warm-up ramp"]].map(([k, name]) => (
          <label key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", cursor: "pointer" }}>
            <input type="checkbox" checked={!!state.settings[k]} onChange={(e) => set(k, e.target.checked)} style={{ width: 20, height: 20 }} />
            <span style={{ fontSize: 14 }}>{name}</span>
          </label>
        ))}
        <p style={{ fontSize: 11, color: C.faint, lineHeight: 1.7, marginTop: 8 }}>
          Worth knowing: a web page can't alert you once the phone is locked, and iOS ignores vibrate
          entirely. The timer keeps correct time in your pocket — it just can't tap you on the shoulder.
        </p>
      </div>

      <div style={card}>
        <div style={{ ...lbl, marginBottom: 10 }}>Your data</div>
        <p style={{ fontSize: 12, color: C.dim, lineHeight: 1.7, marginBottom: 14 }}>
          {(state.history || []).length} sessions and {(state.symptoms || []).length} symptom entries live in
          one browser key. Copy it somewhere occasionally — that's the difference between a bad day and starting over.
        </p>
        <button onClick={copy} style={bigBtn}>{copied ? "Copied to clipboard" : "Copy my data as JSON"}</button>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------- guide */
function Guide({ state }) {
  const adapted = PROGRAMS[state.program].adapted;
  const items = [
    ["Training max (TM)",
      "Your heaviest clean 3 reps, minus 10 lbs. It's deliberately below what you can actually lift. Every working weight is a percentage of it, so keeping it honest keeps the whole program honest."],
    ["The three phases",
      "Phase 1 is 70% for 4 sets of 6. Phase 2 is 75% for 5 sets of 5. Phase 3 is 80% for 7 sets of 4. One week each, so a cycle is 21 days. Weight goes up, reps come down — that's the whole progression."],
    ["Speed sets",
      "After the heavy sets, drop 20% off the bar and do 2 sets of 8-10 fast reps. Never to failure. The point is bar speed, which builds power without piling on fatigue."],
    ["Rest",
      "2-5 minutes on the percentage sets, 1-2 on accessories. The timer starts itself when you check off a set and picks the right length. Short on time? The program says superset accessories — never cut rest on the main lift."],
    ["Warm up first",
      "The program requires it: foam roll and warm up properly before every session. The Mobility tab has the dynamic work for each day, and the main lift shows a warm-up ramp that doesn't count toward your set total."],
    ["Failing a set",
      "Missing reps means the weight was too heavy or you're under-recovered. The program says decrease the weight or keep it the same — never grind. Log what you actually got and the coach handles the rest."],
    ["Progression",
      "Finish all three phases without failure and training maxes go up 5-10 lbs. Fail somewhere and you re-run the cycle at the same weights. There's no shame in that — it's how the program is designed to work. Stall twice and the coach sends you to the deload week."],
    ["Deload",
      "Same workouts, all weights cut 50%, one week. Optional in the program; the coach recommends it after two stalled cycles because two stalls is a recovery problem, not an effort problem."],
    ["Accessories",
      "Anything without a percentage on it. Pick a weight that makes the last rep of each set hard, and add weight when it stops being hard. The app remembers what you used last time."],
    ["Abs",
      "Hanging leg raises, ball crunches, bicycles — supersetted back to back, 3 rounds, as many reps as you can. 2-3 times a week, on off days or after a session."],
    ["Eating",
      "The program assumes a caloric surplus and a lean bulking phase. Without that the weights won't go up no matter how well you train. Your numbers: about 2,900 calories and 175g protein a day. That protein figure is one gram per pound of bodyweight, which is the top of what the research actually supports — going to 250 or 300g costs real money and buys nothing."],
    ["Eating when you can't store food",
      "No fridge means everything has to be either eaten within ten minutes of cooking or shelf-stable enough to live in the car. What works: eggs cooked fresh, tuna and chicken pouches, a whey tub in the car, oats, peanut butter, a rotisserie chicken eaten across a shift. That combination gets you to 175g without refrigeration. On a 10-hour shift, the protein you actually eat beats the meal plan you couldn't follow."],
    ["Sleep is part of the program",
      "This is the uncomfortable one. Training is the stimulus; sleep and food are where the adaptation actually happens. On broken sleep you can still do the work — you just convert less of it. That's not a reason to train less, it's the reason the Coach tab watches your missed reps: it's the earliest honest signal of whether the volume is turning into anything."],
    ["Your shoulder",
      "The flags come from which tissue a movement loads, not from the word 'shoulder'. A periscapular problem and a shoulder-joint problem want opposite advice: face pulls and reverse pec deck protect the joint but load the scapular retractors directly. That's why they're flagged for you and dips aren't."],
  ];

  if (adapted)
    items.splice(2, 0, [
      "What's adapted here",
      "You're on the 3-day version. Percentages, set/rep schemes, speed sets and progression are exactly as written. What changed: five days of volume redistributed into three, and the movements that load the shoulder joint hardest — weighted dips, heavy overhead press — removed. Two sessions a week done for a year beats five done for three weeks.",
    ]);

  return (
    <>
      <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 8px" }}>How this works</h2>
      <p style={{ color: C.faint, fontSize: 12, lineHeight: 1.7, marginBottom: 26 }}>
        Program: Saiyan Powerbuilding by Matthew Kido (saiyanarmy.com). Percentages, set/rep schemes,
        rest ranges and progression rules are his. Anything this app adds is marked.
      </p>
      {items.map(([t, d], i) => (
        <div key={i} style={{ paddingBottom: 20, marginBottom: 20, borderBottom: i < items.length - 1 ? `1px solid ${C.line}` : "none" }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t}</div>
          <div style={{ fontSize: 14, color: C.dim, lineHeight: 1.7 }}>{d}</div>
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------ program swap */
function ProgramPanel({ state, save }) {
  const [confirm, setConfirm] = useState(null);
  const current = PROGRAMS[state.program];

  const swap = (id) => {
    const before = state;
    save(S.switchProgram(state, id), { undo: before, undoLabel: `Switched to the ${PROGRAMS[id].label}` });
    setConfirm(null);
  };

  return (
    <>
      <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Program</h2>
      <p style={{ color: C.dim, fontSize: 13, lineHeight: 1.7, marginBottom: 22 }}>
        Switch whenever you want. Your maxes, history and symptom log all carry over. A lift with no
        max yet just routes itself to a test day.
      </p>

      {Object.values(PROGRAMS).map((p) => {
        const active = p.id === state.program;
        return (
          <div key={p.id} style={{ ...card, borderColor: active ? C.steel : C.line }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{p.label}</div>
              {active && <div style={{ ...lbl, fontSize: 10, color: C.steel }}>Current</div>}
            </div>
            <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.7, marginBottom: 12 }}>{p.blurb}</div>
            <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.7, marginBottom: active ? 0 : 14 }}>
              {p.id === "full5"
                ? "Four percentage lifts including overhead press. Weighted dips are in. 7-8 exercises a session, 90-120 minutes, five days a week. This is the program exactly as Kido wrote it."
                : "Three percentage lifts. Accessory volume cut, weighted dips out, overhead press demoted to a light accessory. Roughly 60 minutes, three non-consecutive days."}
            </div>
            {!active && (
              <button onClick={() => setConfirm(p.id)} style={{ ...ghostBtn, fontSize: 13, padding: 14 }}>
                Switch to the {p.label}
              </button>
            )}
          </div>
        );
      })}

      <div style={{ ...card, borderStyle: "dashed" }}>
        <div style={{ ...lbl, marginBottom: 8 }}>Worth knowing, once</div>
        <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.7 }}>
          The 5-day isn't harder in a way you can decide to tolerate — it's more total work per week
          than the 3-day, and whether that turns into muscle depends on sleep and food rather than on
          willingness. The Coach tab reads your last six sessions and tells you which way it's going.
          That's the number to argue with, not this one.
        </div>
      </div>

      <Confirm
        open={confirm !== null}
        title={confirm ? `Switch to the ${PROGRAMS[confirm].label}?` : ""}
        body={
          confirm === "full5"
            ? "Five days a week, four percentage lifts, weighted dips included. Your maxes and history come with you. Overhead press has no max yet, so it'll start with a test day."
            : "Three days a week, accessory volume cut, dips out. Nothing is lost — you can switch back any time."
        }
        confirmLabel="Switch"
        onConfirm={() => swap(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

/* ---------------------------------------------------------------- readiness */
function ReadinessCard({ state }) {
  const r = readiness(state);
  if (r.status === "unknown") return null;
  const colour = r.status === "digging" ? C.fail : r.status === "watch" ? C.warn : C.done;

  return (
    <div style={{ ...card, borderColor: colour }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div style={{ ...lbl, fontSize: 10, color: colour }}>Recovery · last {r.sessions} sessions</div>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: colour, marginBottom: 12 }}>{r.headline}</div>

      <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
        <Stat n={`${Math.round(r.metrics.completion * 100)}%`} l="reps hit" />
        <Stat n={`${Math.round(r.metrics.missRate * 100)}%`} l="sets short" />
        <Stat n={`${Math.round(r.metrics.abandonRate * 100)}%`} l="left undone" />
        {r.metrics.avgSymptom != null && <Stat n={r.metrics.avgSymptom.toFixed(1)} l="shoulder" />}
      </div>

      {r.why.map((w, i) => (
        <div key={i} style={{ fontSize: 13, color: C.dim, lineHeight: 1.6, marginBottom: 8 }}>{w.text}</div>
      ))}

      {r.suggestion && (
        <div style={{ marginTop: 10, paddingTop: 12, borderTop: `1px solid ${C.line}`, fontSize: 13, color: C.text, lineHeight: 1.7 }}>
          {r.suggestion}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- food */
function FoodView({ state, save }) {
  const [tab, setTab] = useState("today");
  const [editing, setEditing] = useState(null);
  const custom = state.customFoods || [];
  const over = state.foodOverrides || {};
  const targets = state.targets || { cal: 2900, protein: 175 };
  const entries = S.foodToday(state);
  const totals = dayTotals(entries, custom, over);
  const left = remaining(totals, targets);
  const next = suggest(totals, targets, custom, over);

  const add = (id) => save(S.addFood(state, id, 1));
  const bump = (id, d) => {
    const e = entries.find((x) => x.id === id);
    save(S.setServings(state, id, Math.max(0, (e?.servings || 0) + d)));
  };

  return (
    <div style={{ padding: "24px 18px 0" }}>
      <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 16px" }}>Food</h2>

      <div style={card}>
        <Meter label="Protein" have={totals.protein} target={targets.protein} unit="g" colour={C.done} />
        <div style={{ height: 16 }} />
        <Meter label="Calories" have={totals.cal} target={targets.cal} unit="" colour={C.steel} />
        <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.7, marginTop: 16 }}>
          {left.protein > 0
            ? `${left.protein}g protein and ${Math.max(0, left.cal)} calories still to go today.`
            : `Protein done. ${left.cal > 0 ? `${left.cal} calories left if you want them.` : "You're over on calories — fine on a bulk, worth noticing if it's every day."}`}
        </div>
      </div>

      {next.length > 0 && (
        <div style={{ ...card, borderStyle: "dashed" }}>
          <div style={{ ...lbl, marginBottom: 10 }}>Quickest way to close the gap</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {next.map((food) => (
              <button key={food.id} onClick={() => add(food.id)} style={chip}>
                + {food.name} <span style={{ color: C.done }}>{food.protein}g</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, margin: "18px 0" }}>
        {[["today", `Today · ${entries.length}`], ["car", "In the car"], ["cook", "Cook now"]].map(([k, n]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex: 1, padding: "10px 6px", fontSize: 11, fontWeight: 700,
            background: tab === k ? C.steel : C.panel, color: tab === k ? "#0B0E12" : C.dim,
            border: `1px solid ${tab === k ? C.steel : C.line}`, borderRadius: 8, cursor: "pointer",
          }}>{n}</button>
        ))}
      </div>

      {tab === "today" ? (
        entries.length === 0 ? (
          <p style={{ color: C.dim, fontSize: 14, lineHeight: 1.7 }}>
            Nothing logged today. Tap “In the car” or “Cook now” and add what you ate.
          </p>
        ) : (
          entries.map((e) => {
            const food = byId(e.id, custom, over);
            if (!food) return null;
            return (
              <div key={e.id} style={{ ...card, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{food.name}</div>
                    <div style={{ fontSize: 12, color: C.faint }}>
                      {e.servings} × {food.serving} · {food.protein * e.servings}g protein · {food.cal * e.servings} cal
                    </div>
                  </div>
                  <button onClick={() => bump(e.id, -1)} aria-label={`One less ${food.name}`} style={stepBtn}>−</button>
                  <div style={{ fontFamily: mono, fontSize: 17, fontWeight: 700, minWidth: 24, textAlign: "center" }}>
                    {e.servings}
                  </div>
                  <button onClick={() => bump(e.id, 1)} aria-label={`One more ${food.name}`} style={stepBtn}>+</button>
                </div>
              </div>
            );
          })
        )
      ) : (
        [...FOODS, ...custom]
          .filter((x) => x.tags?.includes(tab) || (tab === "car" && x.tags?.includes("custom")))
          .map((x) => {
            const food = { ...x, ...(over[x.id] || {}) };
            const inToday = entries.find((e) => e.id === food.id);
            return (
              <div key={food.id} style={{ ...card, padding: 16, borderColor: inToday ? C.done : C.line }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={() => add(food.id)}
                    style={{ flex: 1, background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: 0 }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                      {inToday ? "✓ " : ""}{food.name}
                    </div>
                    <div style={{ fontSize: 12, color: C.faint }}>
                      {food.serving} · <span style={{ color: C.done }}>{food.protein}g</span> · {food.cal} cal
                    </div>
                  </button>
                  <button onClick={() => add(food.id)} aria-label={`Add ${food.name}`} style={{ ...stepBtn, borderColor: C.steel, color: C.steel }}>+</button>
                </div>
                <button
                  onClick={() => setEditing(editing === food.id ? null : food.id)}
                  aria-expanded={editing === food.id}
                  style={{ background: "none", border: "none", color: C.faint, fontSize: 11, cursor: "pointer", padding: "8px 0 0" }}
                >
                  {editing === food.id ? "Close" : "My label says something different"}
                </button>
                {editing === food.id && (
                  <div style={{ display: "flex", gap: 10, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
                    {[["protein", "Protein g"], ["cal", "Calories"]].map(([k, name]) => (
                      <div key={k} style={{ flex: 1 }}>
                        <label htmlFor={`${food.id}-${k}`} style={{ ...lbl, fontSize: 9, display: "block", marginBottom: 6 }}>{name}</label>
                        <input
                          id={`${food.id}-${k}`}
                          type="number" inputMode="numeric" min="0"
                          value={food[k]}
                          onChange={(ev) => save(S.overrideFood(state, food.id, { [k]: Number(ev.target.value) || 0 }))}
                          style={{
                            width: "100%", padding: 10, fontSize: 15, fontWeight: 700, background: C.bg,
                            border: `1px solid ${C.line}`, borderRadius: 8, color: C.text,
                            fontFamily: mono, boxSizing: "border-box",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
      )}

      <div style={{ ...card, borderStyle: "dashed", marginTop: 18 }}>
        <div style={{ ...lbl, marginBottom: 8 }}>Why these numbers</div>
        <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.7 }}>
          {targets.protein}g protein is one gram per pound of bodyweight — the top of what actually
          builds muscle. More costs money and does nothing. {targets.cal} calories is a lean-bulk
          surplus: enough to grow on, not so much that it's all fat.
          Everything listed here keeps without a fridge or gets eaten straight off the pan.
        </div>
      </div>
      <div style={{ height: 30 }} />
    </div>
  );
}

function Meter({ label: name, have, target, unit, colour }) {
  const pct = Math.min(1, target ? have / target : 0);
  const over = have > target;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ ...lbl, fontSize: 10 }}>{name}</div>
        <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 700 }}>
          <span style={{ color: over ? C.warn : colour }}>{have}</span>
          <span style={{ color: C.faint }}> / {target}{unit}</span>
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuenow={have}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-label={`${name}: ${have} of ${target}${unit}`}
        style={{ height: 10, background: C.bg, borderRadius: 5, overflow: "hidden", border: `1px solid ${C.line}` }}
      >
        <div style={{ height: "100%", width: `${pct * 100}%`, background: over ? C.warn : colour, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

const chip = {
  padding: "10px 14px", borderRadius: 20, border: `1px solid ${C.line}`,
  background: "transparent", color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer",
};
