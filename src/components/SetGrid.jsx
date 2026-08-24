import React, { useRef, useState } from "react";
import { C, mono } from "../theme.js";

/* One tap = you hit the prescribed reps. That's ~90% of sets, so it stays a
   single tap and nothing else. Recording a short set is a second, deliberate
   gesture: long-press a set, or open the row editor. The deviation is the
   only part that carries information, so that's the only part worth typing. */
export default function SetGrid({ exercise, log, onToggle, onReps, onHard, target }) {
  const [open, setOpen] = useState(false);
  const press = useRef(null);
  const longFired = useRef(false);
  const n = exercise.targetSets;
  const numericTarget = Number(target) || null;

  const startPress = (i, done) => {
    longFired.current = false;
    press.current = setTimeout(() => {
      longFired.current = true;
      if (done && numericTarget) setOpen(true);
    }, 500);
  };
  const endPress = (i) => {
    clearTimeout(press.current);
    if (!longFired.current) onToggle(i);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        {Array.from({ length: n }).map((_, i) => {
          const s = log.sets[`${exercise.id}-${i}`];
          const done = !!s?.done;
          const short = done && s.reps != null && numericTarget && s.reps < numericTarget;
          const colour = short ? C.warn : done ? C.done : C.line;
          return (
            <button
              key={i}
              onPointerDown={() => startPress(i, done)}
              onPointerUp={() => endPress(i)}
              onPointerLeave={() => clearTimeout(press.current)}
              aria-label={
                done
                  ? `Set ${i + 1} done${s.reps != null ? `, ${s.reps} reps` : ""}${s.hard ? ", flagged hard" : ""}. Tap to undo.`
                  : `Set ${i + 1} of ${n}, not done. Tap to mark done.`
              }
              aria-pressed={done}
              style={{
                flex: 1, height: 54, borderRadius: 10,
                border: `1px solid ${colour}`,
                background: done ? (short ? "rgba(251,191,36,0.14)" : "rgba(74,222,128,0.14)") : "transparent",
                color: done ? colour : C.dim,
                fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: mono,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
              }}
            >
              {done ? (short ? s.reps : s.hard ? "✓!" : "✓") : i + 1}
            </button>
          );
        })}
      </div>

      {numericTarget ? (
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          style={{
            marginTop: 8, background: "none", border: "none", color: C.faint,
            fontSize: 12, cursor: "pointer", padding: "4px 0", textAlign: "left",
          }}
        >
          {open ? "Hide rep detail" : "Missed reps? Log what you actually got"}
        </button>
      ) : null}

      {open && numericTarget ? (
        <div style={{ marginTop: 6, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
          {Array.from({ length: n }).map((_, i) => {
            const s = log.sets[`${exercise.id}-${i}`];
            if (!s?.done) return null;
            const reps = s.reps == null ? numericTarget : s.reps;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: C.dim, width: 44 }}>Set {i + 1}</div>
                <button onClick={() => onReps(i, Math.max(0, reps - 1))} aria-label={`Set ${i + 1}: one rep fewer`} style={stepper}>−</button>
                <div style={{ fontFamily: mono, fontSize: 17, fontWeight: 700, minWidth: 30, textAlign: "center", color: reps < numericTarget ? C.warn : C.text }}>
                  {reps}
                </div>
                <button onClick={() => onReps(i, reps + 1)} aria-label={`Set ${i + 1}: one rep more`} style={stepper}>+</button>
                <button
                  onClick={() => onHard(i, !s.hard)}
                  aria-pressed={!!s.hard}
                  aria-label={`Set ${i + 1}: flag as hard`}
                  style={{
                    ...stepper, width: "auto", padding: "0 12px", fontSize: 12,
                    color: s.hard ? C.warn : C.faint,
                    borderColor: s.hard ? C.warn : C.line,
                  }}
                >
                  Hard
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const stepper = {
  width: 40, height: 40, borderRadius: 8, border: `1px solid ${C.line}`,
  background: "transparent", color: C.text, fontSize: 18, fontWeight: 700, cursor: "pointer",
};
