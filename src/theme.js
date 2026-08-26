/* CYBR reskin — cyber brutalism.
   One acid accent on near-black, neutrals biased toward the accent's hue,
   zero border radius, mono for everything, a single heavy display face.
   Token names kept stable so the components don't care. */

export const C = {
  bg: "#080908",
  panel: "#0F110C",
  panel2: "#151810",
  line: "#272B1E",
  grid: "#161911",
  text: "#E9EEDD",
  dim: "#98A084",
  faint: "#6A7159",
  steel: "#CDF032", // the acid. legacy token name, everything routes through it
  done: "#CDF032",
  warn: "#FFB300",
  fail: "#FF4D2E",
  mob: "#E9EEDD", // secondary accent is white, like the reference
};

export const ink = "#0A0B06"; // text on acid

export const mono = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
export const display = "'Archivo Black', 'Arial Black', system-ui, sans-serif";

export const card = {
  background: C.panel,
  border: `1px solid ${C.line}`,
  borderRadius: 0,
  padding: 20,
  marginBottom: 14,
};

export const bigBtn = {
  width: "100%",
  padding: "18px",
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  background: C.steel,
  color: ink,
  border: "none",
  borderRadius: 0,
  cursor: "pointer",
  fontFamily: mono,
};

export const ghostBtn = {
  ...bigBtn,
  background: "transparent",
  color: C.dim,
  border: `1px solid ${C.line}`,
  fontSize: 12,
};

export const label = {
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: C.dim,
  fontFamily: mono,
};

/* hazard stripe — the reference's warning-tape motif. used sparingly. */
export const hazard = {
  height: 8,
  background: `repeating-linear-gradient(-45deg, ${C.steel} 0 10px, transparent 10px 20px)`,
  border: `1px solid ${C.line}`,
  borderLeft: "none",
  borderRight: "none",
};
