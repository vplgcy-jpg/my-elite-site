import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GymJournal from "../src/GymJournal.jsx";
import { newState } from "../src/lib/state.js";
import { KEY } from "../src/lib/storage.js";

const seed = (over = {}) => {
  const s = { ...newState({ tm: { bench: 200, squat: 300, deadlift: 350 } }), ...over };
  window.localStorage.setItem(KEY, JSON.stringify(s));
  return s;
};

/* Several exercises legitimately share a set/rep scheme, so queries that
   should target one movement are scoped to its card. */
const card = (name) => within(document.querySelector(`[data-exercise="${name}"]`));

const ready = async () => {
  await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
};

describe("boot", () => {
  it("shows Setup on a genuinely fresh install", async () => {
    render(<GymJournal />);
    await ready();
    expect(await screen.findByText("Pick your week")).toBeInTheDocument();
  });

  it("REGRESSION: a read failure offers a retry and never Setup", async () => {
    // Showing Setup here is data loss: the next save overwrites the real log.
    window.storage = {
      get: vi.fn().mockRejectedValue(new Error("offline")),
      set: vi.fn(),
    };
    render(<GymJournal />);
    await ready();
    expect(await screen.findByText("Couldn't read your data")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText("Pick your week")).not.toBeInTheDocument();
    expect(screen.getByText(/Not starting a new log/i)).toBeInTheDocument();
  });

  it("recovers when the retry succeeds", async () => {
    const user = userEvent.setup();
    const get = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ value: JSON.stringify(newState({ tm: { bench: 200 } })) });
    window.storage = { get, set: vi.fn().mockResolvedValue(undefined) };
    render(<GymJournal />);
    await screen.findByText("Couldn't read your data");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Upper Power" })).toBeInTheDocument();
  });

  it("offers an explicit escape hatch for corrupt data", async () => {
    window.localStorage.setItem(KEY, "{broken");
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByText("Couldn't read your data");
    await user.click(screen.getByRole("button", { name: /Start over anyway/i }));
    expect(await screen.findByText("Pick your week")).toBeInTheDocument();
  });
});

describe("setup", () => {
  it("builds a program from entered maxes", async () => {
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByText("Pick your week");
    await user.click(screen.getByText("3-day"));
    await user.type(await screen.findByLabelText("Bench Press"), "210");
    await user.click(screen.getByRole("button", { name: "Build my program" }));
    // TM = 210 - 10 = 200, phase 1 works at 70% = 140
    expect(await screen.findByText("140")).toBeInTheDocument();
  });

  it("clamps a nonsense max to bar weight instead of going negative", async () => {
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByText("Pick your week");
    await user.click(screen.getByText("3-day"));
    await user.type(await screen.findByLabelText("Bench Press"), "5");
    await user.click(screen.getByRole("button", { name: "Build my program" }));
    await screen.findByRole("heading", { name: "Upper Power" });
    expect(screen.queryByText(/^-\d/)).not.toBeInTheDocument();
  });

  it("routes a blank lift to a test day rather than a zero weight", async () => {
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByText("Pick your week");
    await user.click(screen.getByText("3-day"));
    await user.click(screen.getByRole("button", { name: /test everything/i }));
    expect(await screen.findByText(/Find your Bench Press max/i)).toBeInTheDocument();
  });
});

describe("training", () => {
  beforeEach(() => seed());

  it("shows the working weight, scheme and plate load", async () => {
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    const bench = card("Bench Press");
    expect(bench.getByText("140")).toBeInTheDocument();
    expect(bench.getByText(/4 sets × 6 reps/)).toBeInTheDocument();
    expect(bench.getByLabelText(/Per side: 45 · 2.5/)).toBeInTheDocument();
  });

  it("marks a set done in a single tap", async () => {
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    await user.click(card("Bench Press").getByRole("button", { name: /Set 1 of 4, not done/i }));
    expect(await card("Bench Press").findByRole("button", { name: /Set 1 done/i })).toBeInTheDocument();
  });

  it("starts the rest timer when a set is completed", async () => {
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    await user.click(card("Bench Press").getByRole("button", { name: /Set 1 of 4, not done/i }));
    const timer = await screen.findByRole("timer");
    expect(within(timer).getByText("3:30")).toBeInTheDocument();
  });

  it("lets you record a short set without un-marking it", async () => {
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    const bench = () => card("Bench Press");
    await user.click(bench().getByRole("button", { name: /Set 1 of 4, not done/i }));
    await user.click(bench().getByText(/Missed reps\?/i));
    const minus = await bench().findByLabelText("Set 1: one rep fewer");
    await user.click(minus);
    await user.click(bench().getByLabelText("Set 1: one rep fewer"));
    expect(await bench().findByRole("button", { name: /Set 1 done, 4 reps/i })).toBeInTheDocument();
  });

  it("coaches you the moment a set comes up short", async () => {
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    const bench = () => card("Bench Press");
    await user.click(bench().getByRole("button", { name: /Set 1 of 4, not done/i }));
    await user.click(bench().getByText(/Missed reps\?/i));
    for (let i = 0; i < 3; i++) await user.click(bench().getByLabelText("Set 1: one rep fewer"));
    expect(await bench().findByText(/never grind/i)).toBeInTheDocument();
  });

  it("hides warm-ups behind a toggle and says they don't count", async () => {
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    const toggle = screen.getByText(/doesn't count toward your total/i);
    expect(screen.queryByText("Empty bar", { exact: false })).not.toBeInTheDocument();
    await user.click(toggle);
    expect(await screen.findByText(/Empty bar/)).toBeInTheDocument();
  });

  it("confirms before writing a session to the log", async () => {
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    await user.click(card("Bench Press").getByRole("button", { name: /Set 1 of 4, not done/i }));
    await user.click(screen.getByRole("button", { name: /Finish session/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("offers an undo after logging a session", async () => {
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    await user.click(card("Bench Press").getByRole("button", { name: /Set 1 of 4, not done/i }));
    await user.click(screen.getByRole("button", { name: /Finish session/i }));
    await user.click(await screen.findByRole("button", { name: "Log it" }));
    expect(await screen.findByRole("button", { name: "UNDO" })).toBeInTheDocument();
  });

  it("names the days instead of numbering them", async () => {
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    expect(screen.getByRole("button", { name: "Lower Power" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pull + Shoulders" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Day 1" })).not.toBeInTheDocument();
  });

  it("surfaces a save failure instead of silently dropping it", async () => {
    const user = userEvent.setup();
    window.storage = {
      get: vi.fn().mockResolvedValue({ value: JSON.stringify(newState({ tm: { bench: 200 } })) }),
      set: vi.fn().mockRejectedValue(new Error("quota")),
    };
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    await user.click(card("Bench Press").getByRole("button", { name: /Set 1 of 4, not done/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/didn't save/i);
  });
});

describe("injury awareness", () => {
  beforeEach(() => seed());

  it("substitutes the flagged movements rather than leaving a wall of warnings", async () => {
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    expect(screen.getByText("Day adapted")).toBeInTheDocument();
    expect(screen.getByText("Chest-supported row")).toBeInTheDocument();
    expect(screen.queryByText("T bar rows")).not.toBeInTheDocument();
    expect(screen.queryByText(/Avoid · Right periscapular/i)).not.toBeInTheDocument();
  });

  it("says what each substitution replaced", async () => {
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    expect(screen.getByText("swapped in for T bar rows")).toBeInTheDocument();
  });

  it("lets you see the day as written, flags and all", async () => {
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    await user.click(screen.getByRole("button", { name: /Show the day as written/i }));
    expect(await screen.findByText("T bar rows")).toBeInTheDocument();
    expect(screen.getAllByText(/Avoid · Right periscapular/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Chest-supported row/i)).toBeInTheDocument();
  });

  it("watches but never substitutes a movement kept by choice", async () => {
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    await user.click(screen.getByRole("button", { name: "Pull + Shoulders" }));
    expect((await screen.findAllByText(/Watching · Right periscapular/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/You chose to keep this one/i).length).toBeGreaterThan(0);
  });

  it("leaves the lower day's leg work unflagged", async () => {
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    await user.click(screen.getByRole("button", { name: "Lower Power" }));
    await screen.findByText("Leg press");
    expect(screen.queryByText(/Avoid ·/i)).not.toBeInTheDocument();
  });
});

describe("accessory weight memory", () => {
  it("shows what you used last time", async () => {
    seed({ lastWeights: { "Chest-supported row": 115 } });
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    expect(screen.getByText("last time: 115 lbs")).toBeInTheDocument();
  });

  it("prompts for a starting weight the first time", async () => {
    seed();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    expect(screen.getAllByText(/first time/i).length).toBeGreaterThan(0);
  });
});

describe("mobility", () => {
  beforeEach(() => seed());

  it("prompts a warm-up before lifting, as the program requires", async () => {
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    expect(screen.getByText(/Upper warm-up · 0\/6 done/)).toBeInTheDocument();
  });

  it("splits dynamic work before from static holds after", async () => {
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    await user.click(screen.getByRole("button", { name: "Mobility" }));
    expect(await screen.findByText("Shoulder CARs")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "After" }));
    expect(await screen.findByText(/Static stretching belongs here/i)).toBeInTheDocument();
  });

  it("adds periscapular isometrics to the off-day routine", async () => {
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    await user.click(screen.getByRole("button", { name: "Mobility" }));
    await user.click(screen.getByRole("button", { name: "Off days" }));
    expect(await screen.findByText(/Isometric row hold against a band/i)).toBeInTheDocument();
  });
});

describe("coach view", () => {
  it("waits rather than guessing before a cycle is complete", async () => {
    seed();
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    await user.click(screen.getByRole("button", { name: "Coach" }));
    expect((await screen.findAllByText("0 of 3 phases logged")).length).toBe(3);
    expect(screen.queryByRole("button", { name: /Apply and start/i })).not.toBeInTheDocument();
  });

  it("attributes each reason to the program or to itself", async () => {
    seed();
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    await user.click(screen.getByRole("button", { name: "Coach" }));
    expect((await screen.findAllByText(/Nothing logged for this lift yet/i)).length).toBe(3);
    expect(screen.getAllByText("Coach").length).toBeGreaterThan(0);
  });
});

describe("log view", () => {
  it("explains the empty state", async () => {
    seed();
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    await user.click(screen.getByRole("button", { name: "Log" }));
    expect(await screen.findByText(/Nothing logged yet/i)).toBeInTheDocument();
  });

  it("lets you log a symptom", async () => {
    seed();
    const user = userEvent.setup();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    await user.click(screen.getByRole("button", { name: "Log" }));
    await user.click(await screen.findByText(/Symptoms/));
    await user.click(await screen.findByLabelText("Level 4 of 5"));
    await user.click(screen.getByRole("button", { name: "Log it" }));
    expect(await screen.findByText(/Symptoms · 1/)).toBeInTheDocument();
  });

  it("allows deleting a session, with confirmation", async () => {
    const user = userEvent.setup();
    seed();
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    await user.click(card("Bench Press").getByRole("button", { name: /Set 1 of 4, not done/i }));
    await user.click(screen.getByRole("button", { name: /Finish session/i }));
    await user.click(await screen.findByRole("button", { name: "Log it" }));
    await user.click(screen.getByRole("button", { name: "Log" }));
    await user.click(await screen.findByText("Delete"));
    expect(await screen.findByRole("dialog")).toHaveTextContent(/out of the coach's numbers/i);
  });
});

describe("accessibility", () => {
  beforeEach(() => seed());

  it("names every set button for a screen reader", async () => {
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    for (const b of screen.getAllByRole("button")) {
      const name = b.getAttribute("aria-label") || b.textContent;
      expect(name?.trim().length).toBeGreaterThan(0);
    }
  });

  it("describes the plate load as text, not colour alone", async () => {
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    expect(screen.getAllByLabelText(/Per side:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/per side ·/).length).toBeGreaterThan(0);
  });

  it("marks the current tab for assistive tech", async () => {
    render(<GymJournal />);
    await screen.findByRole("heading", { name: "Upper Power" });
    expect(screen.getByRole("button", { name: "Train" })).toHaveAttribute("aria-current", "page");
  });
});
