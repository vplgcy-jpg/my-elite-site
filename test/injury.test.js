import { describe, it, expect } from "vitest";
import {
  injuryFlag, loadFor, cappedWeight, STAGES, DEFAULT_INJURIES,
} from "../src/lib/injury.js";
import { PHASES } from "../src/lib/program.js";

const periscap = (stage, keep = []) => [
  { id: "p", region: "periscapular", label: "Right periscapular", stage, keep, muted: false },
];

describe("region-specific flagging", () => {
  it("flags direct scapular retraction work for a periscapular injury", () => {
    const inj = periscap("healing");
    expect(injuryFlag("Face pulls", inj).severity).toBe("avoid");
    expect(injuryFlag("Bent over rows", inj).severity).toBe("avoid");
    expect(injuryFlag("Reverse pec deck machine", inj).severity).toBe("avoid");
  });

  it("does NOT flag those same movements for a shoulder-joint injury", () => {
    // This is the whole point of tracking region rather than the word "shoulder":
    // face pulls protect the glenohumeral joint and load the periscapular tissue.
    const gh = [{ id: "g", region: "glenohumeral", stage: "healing", keep: [] }];
    expect(injuryFlag("Face pulls", gh)).toBeNull();
    expect(injuryFlag("Bent over rows", gh)).toBeNull();
    expect(injuryFlag("Weighted dips", gh).severity).toBe("avoid");
  });

  it("flags dips for the joint but not for the scapula", () => {
    expect(injuryFlag("Weighted dips", periscap("healing")).severity).toBe("caution");
    expect(injuryFlag("Weighted dips", [{ id: "g", region: "glenohumeral", stage: "healing", keep: [] }]).severity).toBe("avoid");
  });

  it("leaves unrelated movements alone", () => {
    const inj = periscap("healing");
    expect(injuryFlag("Leg press", inj)).toBeNull();
    expect(injuryFlag("Leg extensions", inj)).toBeNull();
    expect(injuryFlag("Lying hamstring curls", inj)).toBeNull();
  });

  it("respects a muted injury", () => {
    const muted = [{ ...periscap("acute")[0], muted: true }];
    expect(injuryFlag("Face pulls", muted)).toBeNull();
  });

  it("returns null with no injuries at all", () => {
    expect(injuryFlag("Deadlifts", [])).toBeNull();
    expect(injuryFlag("Deadlifts", undefined)).toBeNull();
  });
});

describe("stage gating", () => {
  it("lets everything through once cleared", () => {
    const inj = periscap("clear");
    expect(injuryFlag("Face pulls", inj)).toBeNull();
    expect(injuryFlag("Deadlifts", inj)).toBeNull();
  });
  it("flags even incidental load when acute", () => {
    const inj = periscap("acute");
    expect(injuryFlag("Incline dumbbell bench", inj)).not.toBeNull();
  });
  it("gets progressively more permissive", () => {
    const order = ["acute", "healing", "guarded", "clear"];
    const loads = order.map((s) => STAGES[s].maxLoad);
    expect(loads).toEqual([...loads].sort((a, b) => a - b));
  });
});

describe("explicitly kept movements", () => {
  const inj = periscap("healing", ["Deadlifts"]);

  it("still flags them, but as watched rather than avoided", () => {
    const f = injuryFlag("Deadlifts", inj);
    expect(f).not.toBeNull();
    expect(f.severity).toBe("watch");
    expect(f.kept).toBe(true);
  });
  it("never offers a substitute for them", () => {
    expect(injuryFlag("Deadlifts", inj).swap).toBeNull();
  });
  it("still substitutes everything else", () => {
    expect(injuryFlag("Bent over rows", inj).swap).toBeTruthy();
  });
  it("never reduces their weight", () => {
    expect(cappedWeight(315, inj, "Deadlifts").capped).toBe(false);
  });
});

describe("cappedWeight", () => {
  it("reduces movements that load the tissue directly", () => {
    const r = cappedWeight(200, periscap("healing"), "Bent over rows");
    expect(r.capped).toBe(true);
    expect(r.weight).toBe(170); // 200 * 0.85
  });

  it("REGRESSION: never caps a lift with only incidental demand", () => {
    // Capping load-2 lifts compounds against the phase percentage. A Phase 3
    // bench at 80% of TM, capped a further 15%, lands at 68% of TM — below
    // where Phase 1 started, so the lift could never progress.
    const inj = periscap("healing");
    const tm = 200;
    const p1 = tm * PHASES[0].pct;
    const p3 = tm * PHASES[2].pct;
    const capped = cappedWeight(p3, inj, "Bench Press");
    expect(capped.capped).toBe(false);
    expect(capped.weight).toBe(p3);
    expect(capped.weight).toBeGreaterThan(p1);
  });

  it("does not cap at full-permission stages", () => {
    expect(cappedWeight(200, periscap("guarded"), "Bent over rows").capped).toBe(false);
    expect(cappedWeight(200, periscap("clear"), "Bent over rows").capped).toBe(false);
  });

  it("reports what it capped from", () => {
    const r = cappedWeight(200, periscap("acute"), "Face pulls");
    expect(r.from).toBe(200);
    expect(r.weight).toBeLessThan(200);
  });
});

describe("loadFor", () => {
  it("reports the worst load across multiple injuries", () => {
    const both = [
      { id: "a", region: "periscapular", stage: "healing", keep: [] },
      { id: "b", region: "glenohumeral", stage: "healing", keep: [] },
    ];
    expect(loadFor("Weighted dips", both).load).toBe(3); // glenohumeral wins
    expect(loadFor("Bent over rows", both).load).toBe(3); // periscapular wins
  });
});

describe("this user's configured default", () => {
  it("is a healing right periscapular injury with deadlifts kept", () => {
    const inj = DEFAULT_INJURIES[0];
    expect(inj.region).toBe("periscapular");
    expect(inj.side).toBe("right");
    expect(inj.stage).toBe("healing");
    expect(inj.keep).toContain("Deadlifts");
  });
  it("watches deadlifts, avoids face pulls, and passes leg work clean", () => {
    expect(injuryFlag("Deadlifts", DEFAULT_INJURIES).severity).toBe("watch");
    expect(injuryFlag("Face pulls", DEFAULT_INJURIES).severity).toBe("avoid");
    expect(injuryFlag("Leg press", DEFAULT_INJURIES)).toBeNull();
  });
});
