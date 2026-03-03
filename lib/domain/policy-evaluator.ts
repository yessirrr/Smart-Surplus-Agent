import type { PolicyDecision, SpendingForecast } from "@/lib/types";
import type { CashflowSnapshot } from "./cashflow-model";
import type { DecisionIntent } from "./decision-intent";
import type { DecisionSimulationV2 } from "./decision-simulator";

export interface EvaluateDecisionPolicyArgs {
  intentType: DecisionIntent["intentType"];
  cadence?: DecisionIntent["cadence"] | null;
  snapshot: CashflowSnapshot;
  forecast?: SpendingForecast | null;
  simulation: DecisionSimulationV2;
}

export interface ForecastFreeCash {
  freeCashP50?: number;
  freeCashP90?: number;
}

export function computeForecastFreeCash(
  snapshot: CashflowSnapshot,
  forecast: SpendingForecast
): ForecastFreeCash {
  return {
    freeCashP50: round2(snapshot.chequingBalance - forecast.p50WindowSpend),
    freeCashP90: round2(snapshot.chequingBalance - forecast.p90WindowSpend),
  };
}

export function evaluateDecisionPolicy(args: EvaluateDecisionPolicyArgs): PolicyDecision {
  const reasonCodes: string[] = [];
  let action: PolicyDecision["action"] = "allow";
  let safetyPercentileUsed: 50 | 90 | undefined;

  const minCushionMonths =
    Number.isFinite(args.simulation.targetBufferMonths) && args.simulation.targetBufferMonths > 0
      ? args.simulation.targetBufferMonths
      : 2;

  if (args.simulation.bufferMonthsAfter < minCushionMonths) {
    action = "block";
    reasonCodes.push("SAFETY_CUSHION_BELOW_MIN");
  }

  const projectedBalanceNegative =
    args.simulation.freeCashAfter < 0 ||
    (typeof args.simulation.projectedFreeCashAtPurchase === "number" &&
      args.simulation.projectedFreeCashAtPurchase < 0);

  if (projectedBalanceNegative) {
    action = "block";
    reasonCodes.push("PROJECTED_BALANCE_NEGATIVE");
  }

  const gapToSafeBudget = args.simulation.gapToSafeBudget ?? 0;
  const reducesAmount = args.simulation.recommendedAction.type === "reduce_amount";
  const exceedsSafeBudget = gapToSafeBudget > 0 || reducesAmount;

  if (exceedsSafeBudget) {
    if (action === "allow") {
      action = "warn";
    }
    reasonCodes.push("AMOUNT_EXCEEDS_SAFE_BUDGET");
  }

  if (args.forecast) {
    const { freeCashP50, freeCashP90 } = computeForecastFreeCash(
      args.snapshot,
      args.forecast
    );

    if (typeof freeCashP90 === "number" && freeCashP90 < 0) {
      action = "block";
      reasonCodes.push("FREE_CASH_P90_NEGATIVE");
    } else if (typeof freeCashP50 === "number" && freeCashP50 < 0) {
      if (action === "allow") {
        action = "warn";
      }
      reasonCodes.push("FREE_CASH_P50_NEGATIVE");
    }

    safetyPercentileUsed = 90;
  }

  const cadence = args.cadence ?? null;
  const requiresApproval =
    action === "block" ||
    args.intentType === "recurring" ||
    cadence === "weekly" ||
    cadence === "monthly";

  return {
    action,
    reasonCodes: unique(reasonCodes),
    requiresApproval,
    ...(safetyPercentileUsed ? { safetyPercentileUsed } : {}),
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}