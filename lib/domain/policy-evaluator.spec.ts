import assert from "node:assert/strict";
import test from "node:test";
import type { SpendingForecast } from "@/lib/types";
import type { CashflowSnapshot } from "@/lib/domain/cashflow-model";
import type { DecisionSimulationV2 } from "@/lib/domain/decision-simulator";
import { evaluateDecisionPolicy } from "@/lib/domain/policy-evaluator";

function makeSimulation(overrides: Partial<DecisionSimulationV2> = {}): DecisionSimulationV2 {
  return {
    verdict: "safe",
    reasons: ["BUFFER_RULE_HELD"],
    ruleCode: "BUFFER_RULE_HELD",
    ruleText: "Stays within your 2-month buffer rule.",
    freeCashBefore: 1200,
    freeCashAfter: 1080,
    daysUntilPay: 5,
    bufferMonthsBefore: 2.2,
    bufferMonthsAfter: 2.1,
    targetBufferMonths: 2,
    recommendedAction: {
      type: "proceed",
      title: "Recommended: Proceed now",
      detail: "Within guardrails.",
    },
    meta: {
      intentType: "impulse",
      cadence: "one_time",
      horizon: { kind: "today" },
    },
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<CashflowSnapshot> = {}): CashflowSnapshot {
  return {
    monthlyIncome: 4200,
    monthlyEssentials: 2000,
    monthlyDiscretionary: 900,
    monthlyHabitSpend: 250,
    currentSurplus: 450,
    potentialSurplus: 700,
    chequingBalance: 300,
    savingsBuffer: 800,
    totalLiquid: 1100,
    monthlyCommitments: 2000,
    daysUntilNextPay: 6,
    freeCashUntilPay: 150,
    dailyBurnRate: 96.67,
    snapshotDateISO: "2025-12-01",
    latestTransactionDateISO: "2025-12-01",
    nextPayDateISO: "2025-12-07",
    ...overrides,
  };
}

test("blocks when cushion falls below minimum safety cushion", () => {
  const decision = evaluateDecisionPolicy({
    intentType: "planned_purchase",
    cadence: "one_time",
    snapshot: makeSnapshot(),
    simulation: makeSimulation({
      bufferMonthsAfter: 1.5,
      targetBufferMonths: 2,
      recommendedAction: {
        type: "reduce_amount",
        title: "Reduce",
        detail: "Reduce",
      },
    }),
  });

  assert.equal(decision.action, "block");
  assert.ok(decision.reasonCodes.includes("SAFETY_CUSHION_BELOW_MIN"));
});

test("blocks when projected balance goes negative", () => {
  const decision = evaluateDecisionPolicy({
    intentType: "impulse",
    cadence: "one_time",
    snapshot: makeSnapshot(),
    simulation: makeSimulation({ freeCashAfter: -10 }),
  });

  assert.equal(decision.action, "block");
  assert.ok(decision.reasonCodes.includes("PROJECTED_BALANCE_NEGATIVE"));
});

test("allows when cushion and projected balance remain safe", () => {
  const decision = evaluateDecisionPolicy({
    intentType: "impulse",
    cadence: "one_time",
    snapshot: makeSnapshot(),
    simulation: makeSimulation(),
  });

  assert.equal(decision.action, "allow");
  assert.equal(decision.reasonCodes.length, 0);
  assert.equal(decision.requiresApproval, false);
});

test("blocks when forecast p90 free cash is negative", () => {
  const forecast: SpendingForecast = {
    windowDays: 6,
    expectedWindowSpend: 250,
    p50WindowSpend: 280,
    p90WindowSpend: 420,
    seed: 42,
    trials: 500,
  };

  const decision = evaluateDecisionPolicy({
    intentType: "impulse",
    cadence: "one_time",
    snapshot: makeSnapshot(),
    forecast,
    simulation: makeSimulation(),
  });

  assert.equal(decision.action, "block");
  assert.ok(decision.reasonCodes.includes("FREE_CASH_P90_NEGATIVE"));
  assert.equal(decision.safetyPercentileUsed, 90);
});