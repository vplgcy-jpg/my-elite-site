/* Plate math. Returns loaded plates per side, largest first, or null when the
   weight can't be made from the available plates. */

export const PLATES = [
  { w: 45, color: "#2F6FB5", h: 46 },
  { w: 35, color: "#C9A227", h: 40 },
  { w: 25, color: "#3E8E5A", h: 33 },
  { w: 10, color: "#8892A0", h: 25 },
  { w: 5, color: "#B4553F", h: 20 },
  { w: 2.5, color: "#6B7480", h: 15 },
];

export function plateMath(total, bar = 45) {
  if (total == null || Number.isNaN(total) || total < bar) return null;
  let perSide = (total - bar) / 2;
  if (perSide === 0) return [];
  const out = [];
  for (const p of PLATES) {
    while (perSide >= p.w - 1e-9) {
      out.push(p);
      perSide -= p.w;
    }
  }
  return perSide > 1e-9 ? null : out;
}

export const plateText = (total, bar = 45) => {
  const p = plateMath(total, bar);
  if (p == null) return null;
  return p.length === 0 ? "just the bar" : p.map((x) => x.w).join(" · ");
};
