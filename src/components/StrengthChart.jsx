import React, { useState, useMemo } from "react";
import { C, mono } from "../theme.js";

/* Single series, so no legend — the title names it. Line is 2px, markers 8px,
   grid and axes are recessive, and only the last point gets a direct label.
   A table view is always one tap away so the data is never colour-only. */
export default function StrengthChart({ points, label, unit = "lbs" }) {
  const [hover, setHover] = useState(null);
  const [table, setTable] = useState(false);

  const W = 320, H = 170, PAD = { t: 16, r: 40, b: 26, l: 34 };

  const geom = useMemo(() => {
    if (!points || points.length === 0) return null;
    const ys = points.map((p) => p.e1rm);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (lo === hi) { lo -= 10; hi += 10; }
    const padY = (hi - lo) * 0.15;
    lo = Math.floor((lo - padY) / 5) * 5;
    hi = Math.ceil((hi + padY) / 5) * 5;
    const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    const x = (i) => PAD.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
    const y = (v) => PAD.t + ih - ((v - lo) / (hi - lo)) * ih;
    return { lo, hi, x, y, iw, ih, ticks: [lo, Math.round((lo + hi) / 2 / 5) * 5, hi] };
  }, [points]);

  if (!points || points.length === 0)
    return (
      <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>
        No sessions logged for {label} yet. Two or three and this starts telling you something.
      </div>
    );

  if (table)
    return (
      <div>
        <ChartHeader label={label} table={table} setTable={setTable} />
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: C.dim, textAlign: "left" }}>
              <th style={th}>Date</th><th style={th}>Cycle</th><th style={th}>Bar</th><th style={th}>Est. 1RM</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={td}>{new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                <td style={td}>{p.cycle}</td>
                <td style={{ ...td, fontFamily: mono }}>{p.weight}</td>
                <td style={{ ...td, fontFamily: mono, color: C.text, fontWeight: 700 }}>{p.e1rm}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  const { x, y, ticks } = geom;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.e1rm).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.e1rm - first.e1rm;

  return (
    <div>
      <ChartHeader label={label} table={table} setTable={setTable} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <div style={{ fontFamily: mono, fontSize: 30, fontWeight: 800 }}>{last.e1rm}</div>
        <div style={{ fontSize: 12, color: C.dim }}>{unit} est. 1RM</div>
        {points.length > 1 && (
          <div style={{ fontSize: 12, color: delta > 0 ? C.done : delta < 0 ? C.warn : C.dim, fontWeight: 700 }}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)} since first logged
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", overflow: "visible", touchAction: "none" }}
        role="img"
        aria-label={`${label} estimated one rep max over ${points.length} sessions, ${first.e1rm} to ${last.e1rm} ${unit}`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          let best = 0, bd = Infinity;
          points.forEach((_, i) => { const dd = Math.abs(x(i) - px); if (dd < bd) { bd = dd; best = i; } });
          setHover(best);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={C.grid} strokeWidth="1" />
            <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill={C.faint} fontFamily={mono}>{t}</text>
          </g>
        ))}

        <path d={d} fill="none" stroke={C.steel} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.e1rm)} r={hover === i ? 5 : 4}
            fill={hover === i ? C.text : C.steel} stroke={C.panel} strokeWidth="2" />
        ))}

        <text x={x(points.length - 1) + 8} y={y(last.e1rm) + 3} fontSize="10" fill={C.dim} fontFamily={mono}>
          {last.e1rm}
        </text>

        {hover != null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke={C.line} strokeWidth="1" strokeDasharray="3 3" />
            <rect x={Math.min(W - 96, Math.max(0, x(hover) - 44))} y={2} width="92" height="30" rx="6" fill={C.panel2} stroke={C.line} />
            <text x={Math.min(W - 90, Math.max(6, x(hover) - 38))} y={14} fontSize="9" fill={C.dim}>
              {new Date(points[hover].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · C{points[hover].cycle}
            </text>
            <text x={Math.min(W - 90, Math.max(6, x(hover) - 38))} y={26} fontSize="11" fill={C.text} fontFamily={mono} fontWeight="700">
              {points[hover].e1rm} {unit} · bar {points[hover].weight}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function ChartHeader({ label, table, setTable }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{label}</div>
      <button
        onClick={() => setTable((t) => !t)}
        style={{ background: "none", border: "none", color: C.faint, fontSize: 11, cursor: "pointer" }}
      >
        {table ? "Show chart" : "Show table"}
      </button>
    </div>
  );
}

const th = { padding: "6px 4px", fontWeight: 600, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" };
const td = { padding: "7px 4px", color: C.dim };
