import { describe, it, expect } from "vitest";
import { parseImport, exportJSON } from "../src/lib/storage.js";
import * as S from "../src/lib/state.js";

const real = () => {
  let s = S.newState({ tm: { bench: 125, squat: 205, deadlift: 255 } });
  s = S.addNote(s, "Squats", "wider stance");
  s = S.logSymptom(s, { level: 3, note: "rows" });
  s = S.toggleSet(s, 1, "main", 0);
  s = S.finishSession(s, 1);
  return s;
};

describe("restoring an exported log", () => {
  it("round-trips a real log without loss", () => {
    const s = real();
    const r = parseImport(exportJSON(s));
    expect(r.ok).toBe(true);
    const back = S.migrate(r.data);
    expect(back.tm).toEqual(s.tm);
    expect(back.history).toHaveLength(1);
    expect(S.lastNote(back, "Squats").text).toBe("wider stance");
    expect(back.symptoms).toHaveLength(1);
  });

  it("summarises what it found before overwriting anything", () => {
    const r = parseImport(exportJSON(real()));
    expect(r.summary.sessions).toBe(1);
    expect(r.summary.notes).toBe(1);
    expect(r.summary.symptoms).toBe(1);
    expect(r.summary.lifts.join(" ")).toMatch(/squat 205/);
  });

  it("rejects text that isn't JSON, and says how to fix it", () => {
    const r = parseImport("my workout log lol");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/valid JSON/i);
  });

  it("rejects JSON that isn't a training log", () => {
    expect(parseImport('{"hello":"world"}').ok).toBe(false);
    expect(parseImport("[1,2,3]").ok).toBe(false);
    expect(parseImport("null").ok).toBe(false);
  });

  it("names the reason rather than failing blankly", () => {
    expect(parseImport('{"hello":"world"}').reason).toMatch(/training maxes/i);
  });

  it("accepts a log with no history yet", () => {
    const r = parseImport(exportJSON(S.newState({ tm: { bench: 125 } })));
    expect(r.ok).toBe(true);
    expect(r.summary.sessions).toBe(0);
  });
});
