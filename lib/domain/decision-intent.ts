export type IntentType = "impulse" | "planned_purchase" | "big_goal" | "recurring";
export type SpendCadence = "one_time" | "weekly" | "monthly";
export type TimeHorizonKind =
  | "today"
  | "this_week"
  | "this_month"
  | "date"
  | "relative_days";

export interface TimeHorizon {
  /** ISO date for kind="date" (YYYY-MM-DD). Integer days for kind="relative_days". Otherwise undefined. */
  value?: string | number;
  kind: TimeHorizonKind;
}

export interface DecisionIntent {
  intentType: IntentType;

  /** Positive CAD amount */
  amount: number;

  /** For impulse + planned_purchase + big_goal (purchase price). For recurring: per-period amount. */
  cadence: SpendCadence;

  /** When the spend would occur (or start). */
  horizon: TimeHorizon;

  /** Optional hint used later for copy/UX; not used in math in this phase. */
  categoryHint?: string | null;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertValidIntent(intent: DecisionIntent): asserts intent is DecisionIntent {
  if (!Number.isFinite(intent.amount) || intent.amount <= 0) {
    throw new Error("DecisionIntent amount must be a positive number.");
  }

  if (intent.intentType === "planned_purchase" || intent.intentType === "big_goal") {
    if (intent.cadence !== "one_time") {
      throw new Error(`${intent.intentType} requires cadence='one_time'.`);
    }
  }

  if (intent.intentType === "impulse" && intent.cadence !== "one_time") {
    throw new Error("impulse intent requires cadence='one_time'.");
  }

  if (intent.intentType === "recurring") {
    if (intent.cadence !== "weekly" && intent.cadence !== "monthly") {
      throw new Error("recurring intent requires cadence='weekly' or cadence='monthly'.");
    }
  }

  const { kind, value } = intent.horizon;

  if (kind === "date") {
    if (typeof value !== "string" || !ISO_DATE_RE.test(value)) {
      throw new Error("TimeHorizon kind='date' requires an ISO date value (YYYY-MM-DD).");
    }
    return;
  }

  if (kind === "relative_days") {
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      throw new Error("TimeHorizon kind='relative_days' requires a non-negative integer value.");
    }
    return;
  }

  if (value !== undefined) {
    throw new Error(`TimeHorizon kind='${kind}' does not accept a value.`);
  }
}
