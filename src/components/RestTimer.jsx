import React, { useEffect, useRef, useState, useCallback } from "react";
import { C, mono } from "../theme.js";

/* Elapsed is computed from a stored timestamp, never by decrementing a counter.
   setInterval gets throttled to a crawl when the phone locks or you switch
   apps — which is exactly what happens between sets — so a counting-down
   variable drifts badly. Reading the clock is immune to that. */
export function useRestTimer(settings = {}) {
  const [timer, setTimer] = useState(null);
  const [, force] = useState(0);
  const fired = useRef(false);

  useEffect(() => {
    if (!timer) return undefined;
    const tick = () => force((n) => n + 1);
    const id = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [timer]);

  const start = useCallback((duration, labelText) => {
    fired.current = false;
    setTimer({ startedAt: Date.now(), duration, label: labelText });
  }, []);
  const stop = useCallback(() => setTimer(null), []);
  const bump = useCallback(
    (secs) => setTimer((t) => (t ? { ...t, duration: Math.max(15, t.duration + secs) } : t)),
    []
  );

  const elapsed = timer ? Math.floor((Date.now() - timer.startedAt) / 1000) : 0;
  const remaining = timer ? timer.duration - elapsed : 0;

  useEffect(() => {
    if (!timer || fired.current || remaining > 0) return undefined;
    fired.current = true;
    if (settings.vibrate && typeof navigator !== "undefined" && navigator.vibrate)
      navigator.vibrate([180, 90, 180]);
    if (settings.sound) beep();
    /* Show "rest done" briefly, then get out of the way. */
    const id = setTimeout(() => setTimer(null), 5000);
    return () => clearTimeout(id);
  }, [timer, remaining, settings.sound, settings.vibrate]);

  return { timer, remaining, start, stop, bump, running: !!timer };
}

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    /* Two short tones — a single one is easy to miss in a loud gym, and a
       double reads unmistakably as "your rest is up". */
    for (const at of [0, 0.28]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = 880;
      const t = ctx.currentTime + at;
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.start(t);
      o.stop(t + 0.2);
    }
  } catch {
    /* audio is a nicety, never a failure */
  }
}

const fmt = (s) => {
  const a = Math.max(0, s);
  return `${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
};

export default function RestTimerBar({ timer, remaining, stop, bump }) {
  if (!timer) return null;
  const over = remaining <= 0;
  const pct = Math.max(0, Math.min(1, remaining / timer.duration));
  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`Rest timer, ${over ? "done" : `${remaining} seconds remaining`}`}
      style={{
        position: "fixed", bottom: 62, left: 0, right: 0, zIndex: 20,
        background: C.panel2, borderTop: `1px solid ${over ? C.done : C.line}`,
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute", top: 0, left: 0, height: 2,
          width: `${pct * 100}%`, background: over ? C.done : C.steel,
          transition: "width 0.25s linear",
        }}
      />
      <div style={{ fontFamily: mono, fontSize: 30, fontWeight: 800, color: over ? C.done : C.text, minWidth: 96 }}>
        {fmt(remaining)}
      </div>
      <div style={{ flex: 1, fontSize: 12, color: C.dim, lineHeight: 1.4 }}>
        {over ? "Rest done. Go when you\u2019re ready." : timer.label}
      </div>
      <button onClick={() => bump(30)} aria-label="Add 30 seconds to rest" style={tBtn}>+30</button>
      <button onClick={stop} aria-label="Skip rest" style={{ ...tBtn, color: C.dim }}>Skip</button>
    </div>
  );
}

const tBtn = {
  padding: "10px 12px", borderRadius: 0, border: `1px solid ${C.line}`,
  background: "transparent", color: C.text, fontSize: 13, fontWeight: 700, cursor: "pointer",
};
