import React from "react";
import { plateMath } from "../lib/plates.js";
import { C, mono } from "../theme.js";

/* Plates drawn per side, largest inboard, sized by weight. Colour is a scan
   aid only — every plate carries its number, so this never reads by hue. */
export default function PlateBar({ total, bar = 45 }) {
  const plates = plateMath(total, bar);
  if (plates == null)
    return (
      <div style={{ fontSize: 12, color: C.faint }}>
        {total < bar ? `Under bar weight (${bar} lb bar)` : "Can't be made from standard plates"}
      </div>
    );
  if (plates.length === 0)
    return <div style={{ fontSize: 12, color: C.dim }}>Just the bar</div>;

  const text = plates.map((p) => p.w).join(" · ");
  return (
    <div>
      <div
        role="img"
        aria-label={`Per side: ${text}`}
        style={{ display: "flex", alignItems: "center", gap: 3, height: 50 }}
      >
        <div aria-hidden="true" style={{ width: 14, height: 5, background: C.faint, borderRadius: 2 }} />
        {plates.map((p, i) => (
          <div
            key={i}
            aria-hidden="true"
            title={`${p.w} lb`}
            style={{
              width: 20, height: p.h, background: p.color, borderRadius: 3,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 800, color: "#0B0E12", fontFamily: mono,
            }}
          >
            {p.w}
          </div>
        ))}
        <div aria-hidden="true" style={{ width: 22, height: 5, background: C.faint, borderRadius: 2 }} />
      </div>
      <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>per side · {text}</div>
    </div>
  );
}
