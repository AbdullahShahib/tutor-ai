import { describe, it, expect } from "vitest";
import { updateMastery, decideNextAction, defaultMasteryState } from "./adaptive";

describe("updateMastery", () => {
  it("increases mastery on a correct answer", () => {
    const state = defaultMasteryState({ masteryScore: 0.4 });
    const next = updateMastery(state, true);
    expect(next.masteryScore).toBeGreaterThan(state.masteryScore);
    expect(next.consecutiveCorrect).toBe(1);
    expect(next.consecutiveIncorrect).toBe(0);
  });

  it("decreases mastery on an incorrect answer", () => {
    const state = defaultMasteryState({ masteryScore: 0.6 });
    const next = updateMastery(state, false);
    expect(next.masteryScore).toBeLessThan(state.masteryScore);
    expect(next.consecutiveIncorrect).toBe(1);
    expect(next.consecutiveCorrect).toBe(0);
  });

  it("stays within [0.02, 0.98] bounds", () => {
    let state = defaultMasteryState({ masteryScore: 0.97 });
    for (let i = 0; i < 20; i++) state = updateMastery(state, true);
    expect(state.masteryScore).toBeLessThanOrEqual(0.98);

    let low = defaultMasteryState({ masteryScore: 0.05 });
    for (let i = 0; i < 20; i++) low = updateMastery(low, false);
    expect(low.masteryScore).toBeGreaterThanOrEqual(0.02);
  });
});

describe("decideNextAction", () => {
  it("advances once mastery threshold + streak are both met", () => {
    const state = defaultMasteryState({ masteryScore: 0.9, consecutiveCorrect: 2 });
    const decision = decideNextAction(state, true, 0.85);
    expect(decision.action).toBe("advance");
  });

  it("does not advance on high mastery alone without a streak", () => {
    const state = defaultMasteryState({ masteryScore: 0.9, consecutiveCorrect: 1 });
    const decision = decideNextAction(state, true, 0.85);
    expect(decision.action).toBe("continue");
  });

  it("escalates after three consecutive misses", () => {
    const state = defaultMasteryState({ masteryScore: 0.4, consecutiveIncorrect: 3 });
    const decision = decideNextAction(state, false, 0.85);
    expect(decision.action).toBe("remediate_escalate");
  });

  it("remediates on a single miss", () => {
    const state = defaultMasteryState({ masteryScore: 0.4, consecutiveIncorrect: 1 });
    const decision = decideNextAction(state, false, 0.85);
    expect(decision.action).toBe("remediate");
  });

  it("continues on a correct answer below threshold", () => {
    const state = defaultMasteryState({ masteryScore: 0.5, consecutiveCorrect: 1 });
    const decision = decideNextAction(state, true, 0.85);
    expect(decision.action).toBe("continue");
  });
});
