import { describe, it, expect, vi } from "vitest";
import { load, save, exportJSON, KEY } from "../src/lib/storage.js";

describe("load", () => {
  it("reports empty for a genuinely fresh install", async () => {
    const r = await load();
    expect(r.ok).toBe(true);
    expect(r.empty).toBe(true);
    expect(r.value).toBeNull();
  });

  it("round-trips a saved state", async () => {
    await save({ cycle: 4, tm: { bench: 200 } });
    const r = await load();
    expect(r.ok).toBe(true);
    expect(r.empty).toBe(false);
    expect(r.value.cycle).toBe(4);
  });

  it("REGRESSION: a read failure is never reported as empty", async () => {
    // If a thrown read looked like a fresh install, the UI would show Setup and
    // the first save would overwrite the user's entire history.
    window.storage = {
      get: vi.fn().mockRejectedValue(new Error("storage offline")),
      set: vi.fn(),
    };
    const r = await load();
    expect(r.ok).toBe(false);
    expect(r.empty).toBe(false);
    expect(r.error).toBeInstanceOf(Error);
  });

  it("REGRESSION: corrupt JSON is a read failure, not a fresh install", async () => {
    window.localStorage.setItem(KEY, "{not valid json");
    const r = await load();
    expect(r.ok).toBe(false);
    expect(r.empty).toBe(false);
    expect(r.corrupt).toBe(true);
    expect(r.raw).toContain("not valid");
  });

  it("treats an empty string as empty, not corrupt", async () => {
    window.localStorage.setItem(KEY, "");
    const r = await load();
    expect(r.ok).toBe(true);
    expect(r.empty).toBe(true);
  });

  it("prefers window.storage when the host provides it", async () => {
    window.storage = {
      get: vi.fn().mockResolvedValue({ value: JSON.stringify({ cycle: 9 }) }),
      set: vi.fn().mockResolvedValue(undefined),
    };
    const r = await load();
    expect(window.storage.get).toHaveBeenCalledWith(KEY);
    expect(r.value.cycle).toBe(9);
  });

  it("reads a window.storage miss as empty", async () => {
    window.storage = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    const r = await load();
    expect(r.ok).toBe(true);
    expect(r.empty).toBe(true);
  });
});

describe("save", () => {
  it("reports success", async () => {
    expect((await save({ a: 1 })).ok).toBe(true);
  });

  it("REGRESSION: reports a write failure instead of swallowing it", async () => {
    // The old build caught, console.error'd and moved on, so the checkmark
    // still turned green and a failed write looked identical to a good one.
    window.storage = {
      get: vi.fn(),
      set: vi.fn().mockRejectedValue(new Error("quota exceeded")),
    };
    const r = await save({ a: 1 });
    expect(r.ok).toBe(false);
    expect(r.error.message).toBe("quota exceeded");
  });
});

describe("exportJSON", () => {
  it("produces readable JSON that parses back", () => {
    const s = { cycle: 2, history: [{ day: "Upper Power" }] };
    const out = exportJSON(s);
    expect(out).toContain("\n");
    expect(JSON.parse(out)).toEqual(s);
  });
});
