export const C = {
  bg: "#0E1116",
  panel: "#161B22",
  panel2: "#1B2129",
  line: "#252C36",
  grid: "#1E252E",
  text: "#E8E6E1",
  dim: "#8A95A3",
  faint: "#5D6875",
  steel: "#5B9DD9",
  done: "#4ADE80",
  warn: "#FBBF24",
  fail: "#F87171",
  mob: "#A78BFA",
};

export const card = {
  background: C.panel,
  border: `1px solid ${C.line}`,
  borderRadius: 14,
  padding: 20,
  marginBottom: 14,
};

export const bigBtn = {
  width: "100%",
  padding: "18px",
  fontSize: 16,
  fontWeight: 700,
  background: C.steel,
  color: "#0B0E12",
  border: "none",
  borderRadius: 12,
  cursor: "pointer",
};

export const ghostBtn = {
  ...bigBtn,
  background: "transparent",
  color: C.dim,
  border: `1px solid ${C.line}`,
  fontSize: 14,
};

export const label = {
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: C.dim,
};

export const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
