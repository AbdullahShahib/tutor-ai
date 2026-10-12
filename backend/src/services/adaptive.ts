/**
 * Bayesian Knowledge Tracing + next-action decision logic.
 * Pure functions — no DB/IO here on purpose, so they're cheap to unit test
 * and safe to reuse in both the request path and the background workers.
 */

export interface MasteryState {
  masteryScore: number;
  pTransit: number;
  pSlip: number;
  pGuess: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
}

export function updateMastery(state: MasteryState, isCorrect: boolean): MasteryState {
  const { masteryScore: m, pTransit, pSlip, pGuess } = state;
  let posterior: number;

  if (isCorrect) {
    posterior = (m * (1 - pSlip)) / (m * (1 - pSlip) + (1 - m) * pGuess);
  } else {
    posterior = (m * pSlip) / (m * pSlip + (1 - m) * (1 - pGuess));
  }

  const learned = posterior + (1 - posterior) * pTransit;
  const clamped = Math.min(0.98, Math.max(0.02, learned));

  return {
    ...state,
    masteryScore: clamped,
    consecutiveCorrect: isCorrect ? state.consecutiveCorrect + 1 : 0,
    consecutiveIncorrect: isCorrect ? 0 : state.consecutiveIncorrect + 1
  };
}

export type NextAction =
  | { action: "advance"; reason: string }
  | { action: "remediate_escalate"; reason: string }
  | { action: "remediate"; reason: string }
  | { action: "continue"; reason: string };

export function decideNextAction(
  state: MasteryState,
  isCorrect: boolean,
  advanceThreshold = 0.85
): NextAction {
  if (state.masteryScore >= advanceThreshold && state.consecutiveCorrect >= 2) {
    return { action: "advance", reason: "mastery threshold reached with a consistent streak" };
  }
  if (!isCorrect && state.consecutiveIncorrect >= 3) {
    return {
      action: "remediate_escalate",
      reason: "three consecutive misses — switch explanation style / flag for review"
    };
  }
  if (!isCorrect) {
    return { action: "remediate", reason: "incorrect — serve an easier or equal-difficulty variation" };
  }
  return { action: "continue", reason: "correct — continue at current difficulty" };
}

export function defaultMasteryState(overrides: Partial<MasteryState> = {}): MasteryState {
  return {
    masteryScore: 0.3,
    pTransit: 0.25,
    pSlip: 0.1,
    pGuess: 0.15,
    consecutiveCorrect: 0,
    consecutiveIncorrect: 0,
    ...overrides
  };
}
