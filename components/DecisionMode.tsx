"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { formatCurrency } from "@/lib/utils";
import { useAgent } from "@/lib/agent/use-agent";
import type { CashflowSnapshot } from "@/lib/domain/cashflow-model";
import type { DecisionModeRunMetadata, PolicyAction, PaySchedule, Transaction } from "@/lib/types";
import {
  TARGET_BUFFER_MONTHS,
  clampMoney,
  diffDaysISO,
  projectDivergence,
  simulateDecisionByIntent,
  type DecisionSimulationV2,
} from "@/lib/domain/decision-simulator";
import {
  assertValidIntent,
  type DecisionIntent,
  type SpendCadence,
  type TimeHorizon,
} from "@/lib/domain/decision-intent";
import {
  deriveForecastSeed,
  forecastVariableSpendUntilNextPay,
} from "@/lib/domain/spending-forecast";
import {
  computeForecastFreeCash,
  evaluateDecisionPolicy,
} from "@/lib/domain/policy-evaluator";
import type {
  ClarificationField,
  ParsedDecisionIntentV2,
} from "@/lib/agent/skills/decision-intent-v2";
import type {
  DecisionExplanationInputV2,
  DecisionExplanationResult,
} from "@/lib/agent/skills/decision-explanation";

const PLACEHOLDERS = [
  "$80 dinner tonight",
  "Netflix $16/month",
  "Couch for $1,000 next month",
  "Can I buy a $10,000 car?",
];

const REASON_LABELS: Record<string, string> = {
  FREE_CASH_NEGATIVE: "Account goes negative before next paycheck",
  BUFFER_LT_1: "Emergency cushion drops below 1 month of essentials",
  BUFFER_LT_2: `Emergency cushion drops below ${TARGET_BUFFER_MONTHS} months of essentials`,
  FUTURE_DATE_EVAL: "Scenario evaluated at the purchase date",
  PROJECTED_CHEQUING_LOW: "Projected account balance is too low on purchase date",
  GOAL_REQUIRES_PLANNING: "Goal requires a savings runway",
  GAP_TO_SAFE_BUDGET: "Amount exceeds safe budget today",
  NO_SAVINGS_CAPACITY: "No monthly savings capacity available",
  RECURRING_RAISES_BURN: "Recurring expense increases monthly drag",
  SURPLUS_NEGATIVE: "Monthly surplus turns negative",
  BUFFER_RULE_HELD: `Emergency cushion stays above ${TARGET_BUFFER_MONTHS} months`,
  FREE_CASH_P90_NEGATIVE: "P90 cash floor goes below $0 before next paycheck",
  FREE_CASH_P50_NEGATIVE: "P50 cash floor goes below $0 before next paycheck",
  BUFFER_LOW: "Emergency cushion is below 1 month",
  BUFFER_CRITICAL: "Emergency cushion is below 0.5 months",
  SAFETY_CUSHION_BELOW_MIN: "Emergency cushion drops below the minimum safety cushion",
  PROJECTED_BALANCE_NEGATIVE: "Projected account balance goes below $0",
  AMOUNT_EXCEEDS_SAFE_BUDGET: "Amount exceeds your safe budget",
};

const VERDICT_STYLE = {
  safe: {
    text: "text-[#cfeec9]",
    chip: "bg-[rgba(11,138,62,0.22)] text-[#9ee19b] border-[rgba(158,225,155,0.36)]",
    label: "You're clear.",
  },
  tight: {
    text: "text-[#f2d994]",
    chip: "bg-[rgba(196,155,60,0.22)] text-[#f2d994] border-[rgba(242,217,148,0.34)]",
    label: "Proceed with caution.",
  },
  risky: {
    text: "text-[#f3a49d]",
    chip: "bg-[rgba(220,67,54,0.20)] text-[#f3a49d] border-[rgba(243,164,157,0.34)]",
    label: "Not safe.",
  },
} as const;

const CONFIDENCE_STYLE = {
  high: "bg-[rgba(11,138,62,0.14)] text-[#9ee19b] border-[rgba(158,225,155,0.32)]",
  medium: "bg-[rgba(196,155,60,0.18)] text-[#f2d994] border-[rgba(242,217,148,0.32)]",
  low: "bg-[rgba(220,67,54,0.18)] text-[#f3a49d] border-[rgba(243,164,157,0.30)]",
} as const;

type Phase = "idle" | "parsing" | "clarifying" | "result";
type ClarifyDateMode = "today" | "this_week" | "this_month" | "date";

interface DecisionModeProps {
  snapshot: CashflowSnapshot;
  transactions: Transaction[];
  paySchedule: PaySchedule;
}

interface DivergenceForkData {
  weeks: number;
  baseline: number[];
  withDecision: number[];
  deltaAt90Days: number;
  assumption: string;
}

interface MetricTileData {
  label: string;
  value: string;
  context: string;
  colorClass: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DIVERGENCE_WEEKS = 12;
const WEEKLY_RATE = 0.07 / 52;

export function DecisionMode({ snapshot, transactions, paySchedule }: DecisionModeProps) {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const [parsedIntent, setParsedIntent] = useState<ParsedDecisionIntentV2 | null>(null);
  const [resolvedIntent, setResolvedIntent] = useState<DecisionIntent | null>(null);
  const [simulation, setSimulation] = useState<DecisionSimulationV2 | null>(null);
  const [decisionMeta, setDecisionMeta] = useState<DecisionModeRunMetadata | null>(null);
  const [divergence, setDivergence] = useState<DivergenceForkData | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);

  const [clarifyAmount, setClarifyAmount] = useState("");
  const [clarifyCadence, setClarifyCadence] = useState<SpendCadence | null>(null);
  const [clarifyDateMode, setClarifyDateMode] = useState<ClarifyDateMode>("this_week");
  const [clarifyDateValue, setClarifyDateValue] = useState("");
  const [clarifyGoalName, setClarifyGoalName] = useState("");
  const [clarifyBudgetCap, setClarifyBudgetCap] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  const {
    data: explanation,
    loading: explanationLoading,
    generate: fetchExplanation,
  } = useAgent<DecisionExplanationResult>("/api/agent/decision");

  useEffect(() => {
    if (phase !== "idle" || input.trim().length > 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, [phase, input]);

  const missingFields = parsedIntent?.clarificationFields ?? [];

  const confidenceLabel =
    explanation?.confidence ??
    (parsedIntent?.needsClarification ? "low" : simulation ? "medium" : "high");

  const displayedVerdict = decisionMeta?.policy
    ? mapPolicyActionToVerdict(decisionMeta.policy.action)
    : "safe";

  const runScenario = useCallback(
    (parsed: ParsedDecisionIntentV2, clarificationUsed: boolean) => {
      const intent = toDomainIntent(parsed);
      const seed = deriveForecastSeed({
        snapshotDateISO: snapshot.snapshotDateISO,
        intent,
      });

      const forecast = forecastVariableSpendUntilNextPay({
        transactions,
        snapshot,
        paySchedule,
        seed,
        trials: 500,
        lookbackDays: 90,
      });

      const nextSimulation = simulateDecisionByIntent(intent, snapshot);
      const nextForecastCash = computeForecastFreeCash(snapshot, forecast);
      const nextPolicy = evaluateDecisionPolicy({
        intentType: intent.intentType,
        cadence: intent.cadence,
        snapshot,
        forecast,
        simulation: nextSimulation,
      });
      const nextDivergence = buildDivergenceData(intent, nextSimulation, snapshot);

      const nextMeta: DecisionModeRunMetadata = {
        forecast,
        freeCashP50: nextForecastCash.freeCashP50,
        freeCashP90: nextForecastCash.freeCashP90,
        policy: nextPolicy,
      };

      setResolvedIntent(intent);
      setSimulation(nextSimulation);
      setDecisionMeta(nextMeta);
      setDivergence(nextDivergence);
      setShowReasoning(false);
      setPhase("result");

      const daysUntilPurchase =
        intent.intentType === "planned_purchase" && nextSimulation.projectedDate
          ? diffDaysISO(getTodayISO(snapshot), nextSimulation.projectedDate)
          : null;

      const reasonCodes = [
        ...nextSimulation.reasons,
        ...nextPolicy.reasonCodes,
      ];

      const payload: DecisionExplanationInputV2 = {
        version: "v2",
        intent: {
          title: parsed.title,
          intentType: intent.intentType,
          cadence: intent.cadence,
          horizon: intent.horizon,
          categoryHint: intent.categoryHint,
        },
        simulation: nextSimulation,
        facts: {
          freeCashUntilPay: snapshot.freeCashUntilPay,
          daysUntilNextPay: snapshot.daysUntilNextPay,
          bufferMonthsBefore: nextSimulation.bufferMonthsBefore,
          bufferMonthsAfter: nextSimulation.bufferMonthsAfter,
          monthlySurplus: snapshot.currentSurplus,
          potentialSurplus: snapshot.potentialSurplus,
          monthlyIncome: snapshot.monthlyIncome,
          monthlyEssentials: snapshot.monthlyEssentials,
          monthlyDiscretionary: snapshot.monthlyDiscretionary,
          projectedDate: nextSimulation.projectedDate ?? null,
          daysUntilPurchase,
          projectedFreeCashAtPurchase: nextSimulation.projectedFreeCashAtPurchase ?? null,
          bufferAtPurchase: nextSimulation.bufferMonthsAfter,
          recurringImpactMonthly: nextSimulation.recurringImpactMonthly ?? null,
          gapToSafeBudget: nextSimulation.gapToSafeBudget ?? null,
          monthsToGoal: nextSimulation.monthsToGoal ?? null,
          requiredMonthlySavings: nextSimulation.monthlySavingsNeeded ?? null,
          targetBufferMonths: nextSimulation.targetBufferMonths,
          divergenceDelta90d: nextDivergence?.deltaAt90Days ?? null,
          forecastExpectedWindowSpend: forecast.expectedWindowSpend,
          forecastP50WindowSpend: forecast.p50WindowSpend,
          forecastP90WindowSpend: forecast.p90WindowSpend,
          forecastWindowDays: forecast.windowDays,
          forecastTrials: forecast.trials,
          forecastSeed: forecast.seed,
          freeCashP50: nextForecastCash.freeCashP50 ?? null,
          freeCashP90: nextForecastCash.freeCashP90 ?? null,
          policyAction: nextPolicy.action,
          policyReasonCodes: nextPolicy.reasonCodes,
          policySafetyPercentileUsed: nextPolicy.safetyPercentileUsed ?? null,
          policyRequiresApproval: nextPolicy.requiresApproval,
        },
        reasonCodes,
        clarificationUsed,
        assumptions: buildAssumptions(parsed, intent, nextSimulation),
        forecast,
        policy: nextPolicy,
        freeCashP50: nextForecastCash.freeCashP50,
        freeCashP90: nextForecastCash.freeCashP90,
      };

      fetchExplanation(payload as unknown as Record<string, unknown>);
    },
    [fetchExplanation, paySchedule, snapshot, transactions]
  );

  const hydrateClarificationState = useCallback((parsed: ParsedDecisionIntentV2) => {
    setClarifyAmount(parsed.amount !== null ? String(parsed.amount) : "");
    setClarifyCadence(parsed.cadence);

    if (parsed.horizon.kind === "date") {
      setClarifyDateMode("date");
      setClarifyDateValue(typeof parsed.horizon.value === "string" ? parsed.horizon.value : "");
    } else if (parsed.horizon.kind === "today") {
      setClarifyDateMode("today");
      setClarifyDateValue("");
    } else if (parsed.horizon.kind === "this_month") {
      setClarifyDateMode("this_month");
      setClarifyDateValue("");
    } else {
      setClarifyDateMode("this_week");
      setClarifyDateValue("");
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("parsing");
    setParsedIntent(null);
    setResolvedIntent(null);
    setSimulation(null);
    setDecisionMeta(null);
    setDivergence(null);

    try {
      const res = await fetch("/api/decision/parse-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Parse failed: ${res.status}`);
      }

      const parsed = (await res.json()) as ParsedDecisionIntentV2;
      if (controller.signal.aborted) return;

      setParsedIntent(parsed);
      hydrateClarificationState(parsed);

      if (parsed.needsClarification) {
        setPhase("clarifying");
        return;
      }

      runScenario(parsed, false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setPhase("idle");
    }
  }, [input, hydrateClarificationState, runScenario]);

  const handleClarifySubmit = useCallback(() => {
    if (!parsedIntent) return;

    const resolvedParsed = applyClarifications(parsedIntent, {
      amountInput: clarifyAmount,
      cadence: clarifyCadence,
      dateMode: clarifyDateMode,
      dateValue: clarifyDateValue,
      goalName: clarifyGoalName,
      budgetCapInput: clarifyBudgetCap,
    });

    setParsedIntent(resolvedParsed);

    if (resolvedParsed.needsClarification) {
      setPhase("clarifying");
      return;
    }

    runScenario(resolvedParsed, true);
  }, [
    parsedIntent,
    clarifyAmount,
    clarifyCadence,
    clarifyDateMode,
    clarifyDateValue,
    clarifyGoalName,
    clarifyBudgetCap,
    runScenario,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleReset = useCallback(() => {
    setInput("");
    setPhase("idle");
    setParsedIntent(null);
    setResolvedIntent(null);
    setSimulation(null);
    setDecisionMeta(null);
    setDivergence(null);
    setShowReasoning(false);
    setClarifyAmount("");
    setClarifyCadence(null);
    setClarifyDateMode("this_week");
    setClarifyDateValue("");
    setClarifyGoalName("");
    setClarifyBudgetCap("");
  }, []);

  const metricTiles = useMemo(() => {
    if (!resolvedIntent || !simulation) {
      return null;
    }

    return buildMetricTiles(resolvedIntent, simulation, displayedVerdict);
  }, [displayedVerdict, resolvedIntent, simulation]);

  const placeholder = PLACEHOLDERS[placeholderIndex];

  return (
    <section className="rounded-[16px] bg-gradient-to-b from-ws-white to-[rgba(245,244,240,0.75)] border border-ws-border p-5 sm:p-6">
      <div className="max-w-[860px] mx-auto">
        <p className="text-[11px] tracking-[0.12em] uppercase text-ws-grey">Decision Mode</p>
        <h3 className="text-[1.45rem] sm:text-[1.9rem] font-bold text-ws-charcoal mt-2 leading-tight">
          Ask once. See the fork before you spend.
        </h3>

        <div className="mt-5 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 border-b border-ws-border pb-1.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={phase === "parsing"}
              placeholder={`e.g. ${placeholder}`}
              className="w-full bg-transparent text-sm sm:text-base text-ws-charcoal outline-none placeholder:text-ws-grey disabled:opacity-60"
            />
          </div>

          {phase === "idle" || phase === "parsing" ? (
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || phase === "parsing"}
              className="px-5 py-2.5 rounded-[72px] bg-ws-charcoal text-white text-sm font-bold disabled:opacity-35"
            >
              {phase === "parsing" ? "Parsing..." : "Check"}
            </button>
          ) : (
            <button
              onClick={handleReset}
              className="px-5 py-2.5 rounded-[72px] bg-ws-off-white text-ws-charcoal text-sm font-bold"
            >
              Clear
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {phase === "parsing" && (
            <motion.p
              key="parsing"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="text-xs text-ws-grey mt-3"
            >
              Parsing intent and composing your decision beat...
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === "clarifying" && parsedIntent && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-5 p-4 rounded-[12px] bg-ws-off-white border border-ws-border"
            >
              <p className="text-sm text-ws-charcoal font-medium">
                {parsedIntent.clarificationQuestion ?? "One detail needed to run this scenario:"}
              </p>

              {missingFields.includes("amount") && (
                <div className="mt-3 flex items-center gap-1 border-b border-ws-border pb-1.5">
                  <span className="text-lg font-bold text-ws-charcoal">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={clarifyAmount}
                    onChange={(e) => setClarifyAmount(cleanMoneyInput(e.target.value))}
                    placeholder="0"
                    className="flex-1 bg-transparent outline-none text-lg font-bold text-ws-charcoal placeholder:text-ws-light-grey"
                  />
                </div>
              )}

              {missingFields.includes("cadence") && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {([
                    { label: "One-time", value: "one_time" },
                    { label: "Weekly", value: "weekly" },
                    { label: "Monthly", value: "monthly" },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setClarifyCadence(option.value)}
                      className={`px-3 py-1.5 rounded-[72px] text-xs font-bold border transition-colors ${
                        clarifyCadence === option.value
                          ? "bg-ws-charcoal text-white border-ws-charcoal"
                          : "bg-ws-white text-ws-grey border-ws-border"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              {(missingFields.includes("date") || missingFields.includes("relative_days")) && (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-2">
                    {([
                      { label: "Today", value: "today" },
                      { label: "This week", value: "this_week" },
                      { label: "This month", value: "this_month" },
                      { label: "Pick date", value: "date" },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setClarifyDateMode(option.value)}
                        className={`px-3 py-1.5 rounded-[72px] text-xs font-bold border transition-colors ${
                          clarifyDateMode === option.value
                            ? "bg-ws-charcoal text-white border-ws-charcoal"
                            : "bg-ws-white text-ws-grey border-ws-border"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {clarifyDateMode === "date" && (
                    <input
                      type="text"
                      value={clarifyDateValue}
                      onChange={(e) => setClarifyDateValue(e.target.value.trim())}
                      placeholder="YYYY-MM-DD"
                      className="mt-2 w-full sm:w-[220px] bg-ws-white border border-ws-border rounded-[8px] px-3 py-2 text-sm text-ws-charcoal outline-none"
                    />
                  )}
                </div>
              )}

              {missingFields.includes("goal_name") && (
                <input
                  type="text"
                  value={clarifyGoalName}
                  onChange={(e) => setClarifyGoalName(e.target.value)}
                  placeholder="What are you planning to buy?"
                  className="mt-3 w-full bg-ws-white border border-ws-border rounded-[8px] px-3 py-2 text-sm text-ws-charcoal outline-none"
                />
              )}

              {missingFields.includes("budget_cap") && (
                <div className="mt-3 flex items-center gap-1 border-b border-ws-border pb-1.5">
                  <span className="text-base font-bold text-ws-charcoal">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={clarifyBudgetCap}
                    onChange={(e) => setClarifyBudgetCap(cleanMoneyInput(e.target.value))}
                    placeholder="Optional budget cap"
                    className="flex-1 bg-transparent outline-none text-sm text-ws-charcoal placeholder:text-ws-light-grey"
                  />
                </div>
              )}

              <button
                onClick={handleClarifySubmit}
                className="mt-4 px-4 py-2 rounded-[72px] bg-ws-charcoal text-white text-sm font-bold"
              >
                Continue
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === "result" && simulation && resolvedIntent && metricTiles && decisionMeta?.policy && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="mt-6"
            >
              <div className="rounded-[18px] bg-ws-charcoal text-white p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[11px] uppercase tracking-[0.08em] rounded-[72px] px-2.5 py-1 border ${VERDICT_STYLE[displayedVerdict].chip}`}
                  >
                    {VERDICT_STYLE[displayedVerdict].label}
                  </span>
                  <span
                    className={`text-[11px] uppercase tracking-[0.08em] rounded-[72px] px-2.5 py-1 border ${CONFIDENCE_STYLE[confidenceLabel]}`}
                  >
                    {confidenceLabel} confidence
                  </span>
                </div>

                <p className={`mt-4 text-[2.05rem] sm:text-[2.7rem] leading-none font-bold ${VERDICT_STYLE[displayedVerdict].text}`}>
                  {VERDICT_STYLE[displayedVerdict].label}
                </p>
                <p className="text-sm sm:text-base text-[rgba(255,255,255,0.9)] mt-3">
                  {buildWhyLine(resolvedIntent, simulation, decisionMeta.policy.action)}
                </p>
                <p className="text-[11px] text-[rgba(255,255,255,0.72)] mt-1">
                  Using 90% safety floor (P90)
                </p>
                <p className="text-xs text-[rgba(255,255,255,0.72)] mt-1 min-h-[18px]">
                  {explanationLoading
                    ? "Narrating scenario..."
                    : explanation?.headline ?? "Decision translated into plain terms."}
                </p>
              </div>

              <div className="mt-4 rounded-[14px] border border-ws-border bg-ws-white p-4 sm:p-5">
                {divergence ? (
                  <ForkScene projection={divergence} />
                ) : (
                  <GoalRunway simulation={simulation} amount={resolvedIntent.amount} />
                )}
              </div>

              <div className="mt-4 rounded-[14px] border border-ws-border bg-ws-white p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] text-ws-grey">Recommended action</p>
                <p className="text-lg font-bold text-ws-charcoal mt-2">
                  {simulation.recommendedAction.title}
                </p>
                <p className="text-sm text-ws-grey mt-1">
                  {simulation.recommendedAction.detail}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {metricTiles.map((tile) => (
                  <MetricTile key={tile.label} tile={tile} />
                ))}
              </div>

              <div className="mt-4 rounded-[12px] border border-ws-border bg-ws-white p-4">
                {explanationLoading ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 rounded bg-ws-light-grey" />
                    <div className="h-3 rounded bg-ws-light-grey w-5/6" />
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-ws-charcoal leading-relaxed">
                      {explanation?.explanation ?? "Simulation complete."}
                    </p>
                    <p className="text-xs text-ws-grey mt-1">{explanation?.suggestion}</p>
                  </>
                )}

                <button
                  onClick={() => setShowReasoning((v) => !v)}
                  className="text-xs text-ws-grey underline mt-3"
                >
                  {showReasoning ? "Hide how Odysseus calculated this" : "How Odysseus calculated this"}
                </button>

                <AnimatePresence>
                  {showReasoning && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 rounded-[8px] bg-ws-off-white p-3 space-y-2">
                        <p className="text-[11px] text-ws-grey uppercase tracking-wide">Machine reasons</p>
                        <p className="text-xs text-ws-charcoal">
                          {[...simulation.reasons, ...(decisionMeta.policy.reasonCodes ?? [])].map((r) => REASON_LABELS[r] ?? r).join(" | ")}
                        </p>

                        <p className="text-[11px] text-ws-grey uppercase tracking-wide mt-2">Paycheck timing</p>
                        <p className="text-xs text-ws-charcoal">
                          {simulation.daysUntilPay} days until next paycheck
                        </p>

                        <p className="text-[11px] text-ws-grey uppercase tracking-wide mt-2">Daily spending pace</p>
                        <p className="text-xs text-ws-charcoal">
                          {formatCurrency(snapshot.dailyBurnRate)}/day
                        </p>

                        <p className="text-[11px] text-ws-grey uppercase tracking-wide mt-2">Raw safety math</p>
                        <p className="text-xs text-ws-charcoal">
                          Account before: {formatSignedCurrency(simulation.freeCashBefore)} | Account after: {formatSignedCurrency(simulation.freeCashAfter)} | Cushion before: {simulation.bufferMonthsBefore.toFixed(1)} months | Cushion after: {simulation.bufferMonthsAfter.toFixed(1)} months
                        </p>

                        {explanation?.assumptions && explanation.assumptions.length > 0 && (
                          <>
                            <p className="text-[11px] text-ws-grey uppercase tracking-wide mt-2">Assumptions</p>
                            <p className="text-xs text-ws-charcoal">
                              {explanation.assumptions.join(" | ")}
                            </p>
                          </>
                        )}

                        <p className="text-[11px] text-ws-grey uppercase tracking-wide mt-2">Parsed intent</p>
                        <p className="text-xs text-ws-charcoal">
                          {parsedIntent?.title ?? "Decision"} | {resolvedIntent.intentType} | {resolvedIntent.cadence} | {formatHorizonLabel(resolvedIntent.horizon)}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function buildWhyLine(
  intent: DecisionIntent,
  simulation: DecisionSimulationV2,
  policyAction: PolicyAction
): string {
  if (policyAction === "allow") {
    if (intent.intentType === "planned_purchase") {
      return "Projected purchase-date cash stays above $0 and your emergency cushion stays above the minimum safety cushion.";
    }

    if (intent.intentType === "big_goal") {
      return "This goal fits within your safe budget and keeps your minimum safety cushion intact.";
    }

    if (intent.intentType === "recurring") {
      return "This recurring cost stays within your safety cushion and keeps your monthly surplus positive.";
    }

    return "Your account stays above $0 before your next paycheck and your emergency cushion stays above the minimum safety cushion.";
  }
  if (intent.intentType === "planned_purchase") {
    const projected = simulation.projectedFreeCashAtPurchase ?? simulation.freeCashBefore;
    if (projected < 0) {
      return "Projected account balance goes below $0 on your purchase date.";
    }

    if (simulation.bufferMonthsAfter < simulation.targetBufferMonths) {
      return `Emergency cushion drops below the minimum safety cushion: ${simulation.targetBufferMonths} months.`;
    }

    return "Purchase-date cash stays above $0 and your emergency cushion remains intact.";
  }

  if (intent.intentType === "big_goal") {
    if ((simulation.gapToSafeBudget ?? 0) > 0) {
      return `This goal is above your safe budget today under the ${simulation.targetBufferMonths}-month minimum safety cushion.`;
    }

    return "This goal fits inside your current safety cushion.";
  }

  if (intent.intentType === "recurring") {
    if ((simulation.newPotentialSurplus ?? 0) < 0) {
      return "This recurring cost turns your monthly surplus negative.";
    }

    return "This adds monthly drag but keeps your surplus positive.";
  }

  if (simulation.freeCashAfter < 0) {
    return "This would make your account go negative before your next paycheck.";
  }

  if (simulation.bufferMonthsAfter < simulation.targetBufferMonths) {
    return `This keeps your account above $0, but your emergency cushion drops below ${simulation.targetBufferMonths} months.`;
  }

  return "Your account stays above $0 before your next paycheck and your emergency cushion stays intact.";
}
function MetricTile({ tile }: { tile: MetricTileData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-[12px] border border-ws-border bg-ws-white p-3"
    >
      <p className="text-[10px] uppercase tracking-wide text-ws-grey">{tile.label}</p>
      <p className={`text-[1.22rem] font-bold tabular-nums mt-1 ${tile.colorClass}`}>
        {tile.value}
      </p>
      <p className="text-[11px] text-ws-grey mt-0.5">{tile.context}</p>
    </motion.div>
  );
}

const SVG_W = 420;
const SVG_H = 200;
const PAD_L = 34;
const PAD_R = 34;
const PAD_T = 24;
const PAD_B = 34;

function ForkScene({ projection }: { projection: DivergenceForkData }) {
  const { baseline, withDecision, weeks, deltaAt90Days, assumption } = projection;

  const allValues = [...baseline, ...withDecision];
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  const plotW = SVG_W - PAD_L - PAD_R;
  const plotH = SVG_H - PAD_T - PAD_B;

  function toX(i: number): number {
    return PAD_L + (i / (weeks - 1)) * plotW;
  }

  function toY(v: number): number {
    return PAD_T + plotH - ((v - minVal) / range) * plotH;
  }

  function buildPath(values: number[]): string {
    return values
      .map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`)
      .join(" ");
  }

  const baselinePath = buildPath(baseline);
  const alternatePath = buildPath(withDecision);

  const endX = toX(weeks - 1);
  const baseEndY = toY(baseline[weeks - 1]);
  const altEndY = toY(withDecision[weeks - 1]);
  const midY = (baseEndY + altEndY) / 2;
  const pathLen = plotW * 1.35;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
      <p className="text-[10px] uppercase tracking-[0.12em] text-ws-grey">The fork</p>
      <p className="text-xs text-ws-grey mt-1">{assumption}</p>

      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full mt-3"
        role="img"
        aria-label={`90-day divergence of ${Math.round(deltaAt90Days)} dollars`}
      >
        <motion.path
          d={baselinePath}
          fill="none"
          stroke="#0b8a3e"
          strokeWidth={2.8}
          strokeLinecap="round"
          initial={{ strokeDasharray: pathLen, strokeDashoffset: pathLen }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />

        <motion.path
          d={alternatePath}
          fill="none"
          stroke="#c49b3c"
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeDasharray="5 4"
          initial={{ strokeDasharray: "5 4", strokeDashoffset: pathLen }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 0.95, delay: 0.52, ease: "easeOut" }}
        />

        <motion.circle
          cx={toX(Math.floor((weeks - 1) / 2))}
          cy={toY((baseline[Math.floor((weeks - 1) / 2)] + withDecision[Math.floor((weeks - 1) / 2)]) / 2)}
          r={3.8}
          fill="rgba(50,48,47,0.2)"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.44, duration: 0.24 }}
        />

        <motion.line
          x1={endX + 9}
          y1={baseEndY}
          x2={endX + 9}
          y2={altEndY}
          stroke="rgba(50,48,47,0.22)"
          strokeWidth={1.2}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.42, duration: 0.25 }}
        />

        <motion.text
          x={endX + 16}
          y={midY + 4}
          fill="rgb(50,48,47)"
          fontSize={11}
          fontWeight={700}
          initial={{ opacity: 0, x: endX + 24 }}
          animate={{ opacity: 1, x: endX + 16 }}
          transition={{ delay: 1.72, duration: 0.34 }}
        >
          -{formatCurrency(Math.abs(deltaAt90Days))}
        </motion.text>

        <text x={PAD_L} y={SVG_H - 8} fill="rgb(104,102,100)" fontSize={9}>
          Week 1
        </text>
        <text x={endX - 18} y={SVG_H - 8} fill="rgb(104,102,100)" fontSize={9}>
          Week {weeks}
        </text>
      </svg>
    </motion.div>
  );
}

function GoalRunway({ simulation, amount }: { simulation: DecisionSimulationV2; amount: number }) {
  const hasPlan = simulation.monthsToGoal && simulation.monthlySavingsNeeded;

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-ws-grey">Goal path</p>
      <div className="mt-3 rounded-[10px] bg-ws-off-white px-3 py-3">
        {hasPlan ? (
          <p className="text-sm text-ws-charcoal leading-relaxed">
            To safely afford {formatCurrency(amount)}, save {formatCurrency(simulation.monthlySavingsNeeded ?? 0)}/month for {simulation.monthsToGoal} months while keeping a minimum safety cushion of {simulation.targetBufferMonths} months.
          </p>
        ) : (
          <p className="text-sm text-ws-charcoal leading-relaxed">
            Safe budget today is {formatCurrency(simulation.maxSafeOneTimeSpend ?? 0)} under your minimum safety cushion of {simulation.targetBufferMonths} months.
          </p>
        )}
      </div>
    </div>
  );
}
function cleanMoneyInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [head, ...tail] = cleaned.split(".");
  return tail.length > 0 ? `${head}.${tail.join("")}` : head;
}

function parseMoneyInput(raw: string): number | null {
  if (!raw.trim()) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? clampMoney(parsed) : null;
}

function parseBudgetCap(raw: string): number | null {
  const parsed = parseMoneyInput(raw);
  return parsed !== null ? parsed : null;
}

function applyClarifications(
  parsed: ParsedDecisionIntentV2,
  values: {
    amountInput: string;
    cadence: SpendCadence | null;
    dateMode: ClarifyDateMode;
    dateValue: string;
    goalName: string;
    budgetCapInput: string;
  }
): ParsedDecisionIntentV2 {
  const next: ParsedDecisionIntentV2 = {
    ...parsed,
    clarificationFields: [...parsed.clarificationFields],
  };

  if (parsed.clarificationFields.includes("amount")) {
    next.amount = parseMoneyInput(values.amountInput);
  }

  if (parsed.clarificationFields.includes("cadence")) {
    next.cadence = values.cadence;

    if (next.intentType === "recurring" && values.cadence === "one_time") {
      next.intentType =
        next.horizon.kind === "today" || next.horizon.kind === "this_week"
          ? "impulse"
          : "planned_purchase";
    }
  }

  if (
    parsed.clarificationFields.includes("date") ||
    parsed.clarificationFields.includes("relative_days")
  ) {
    next.horizon =
      values.dateMode === "date" && ISO_DATE_RE.test(values.dateValue)
        ? { kind: "date", value: values.dateValue }
        : values.dateMode === "today"
          ? { kind: "today" }
          : values.dateMode === "this_month"
            ? { kind: "this_month" }
            : { kind: "this_week" };
  }

  if (parsed.clarificationFields.includes("goal_name") && values.goalName.trim()) {
    next.title = `Buy ${values.goalName.trim()}`;
  }

  const cap = parseBudgetCap(values.budgetCapInput);
  if (parsed.clarificationFields.includes("budget_cap") && cap !== null) {
    next.title = `${next.title} (cap ${formatCurrency(cap)})`;
  }

  const unresolved: ClarificationField[] = [];

  if (next.amount === null) {
    unresolved.push("amount");
  }

  if (next.intentType === "recurring" && next.cadence === null) {
    unresolved.push("cadence");
  }

  if (
    next.intentType === "planned_purchase" &&
    next.horizon.kind !== "date" &&
    next.horizon.kind !== "relative_days" &&
    parsed.clarificationFields.includes("date")
  ) {
    unresolved.push("date");
  }

  if (next.intentType === "big_goal" && parsed.clarificationFields.includes("goal_name")) {
    if (next.title.trim().toLowerCase() === "big purchase plan") {
      unresolved.push("goal_name");
    }
  }

  const deduped = [...new Set(unresolved)];

  return {
    ...next,
    needsClarification: deduped.length > 0,
    clarificationFields: deduped,
    clarificationQuestion: deduped.length > 0 ? getClarificationQuestion(deduped) : null,
  };
}

function getClarificationQuestion(fields: ClarificationField[]): string {
  if (fields.includes("amount")) {
    return "How much are you considering spending?";
  }

  if (fields.includes("cadence")) {
    return "Is this one-time, weekly, or monthly?";
  }

  if (fields.includes("date") || fields.includes("relative_days")) {
    return "When would you like to make this purchase?";
  }

  if (fields.includes("goal_name")) {
    return "What are you planning to buy?";
  }

  return "Add one more detail to run this scenario.";
}

function toDomainIntent(parsed: ParsedDecisionIntentV2): DecisionIntent {
  if (parsed.amount === null) {
    throw new Error("Missing amount");
  }

  const cadence: SpendCadence =
    parsed.intentType === "recurring"
      ? parsed.cadence ?? (() => {
          throw new Error("Missing cadence for recurring intent");
        })()
      : "one_time";

  const intent: DecisionIntent = {
    intentType: parsed.intentType,
    amount: parsed.amount,
    cadence,
    horizon: parsed.horizon,
    categoryHint: parsed.categoryHint,
  };

  assertValidIntent(intent);
  return intent;
}

function mapPolicyActionToVerdict(
  action: "allow" | "warn" | "block"
): "safe" | "tight" | "risky" {
  if (action === "allow") return "safe";
  if (action === "warn") return "tight";
  return "risky";
}

function buildMetricTiles(
  intent: DecisionIntent,
  simulation: DecisionSimulationV2,
  verdict: "safe" | "tight" | "risky"
): MetricTileData[] {
  const primary = buildPrimaryMetric(intent, simulation, verdict);
  const secondary = buildSecondaryMetric(intent, simulation);

  return [primary, secondary];
}

function buildPrimaryMetric(
  intent: DecisionIntent,
  simulation: DecisionSimulationV2,
  verdict: "safe" | "tight" | "risky"
): MetricTileData {
  if (intent.intentType === "planned_purchase") {
    const projected = simulation.projectedFreeCashAtPurchase ?? simulation.freeCashBefore;
    return {
      label: simulation.projectedDate
        ? `Projected cash on ${simulation.projectedDate}`
        : "Projected cash on purchase date",
      value: formatSignedCurrency(projected),
      context:
        projected < 0
          ? "Projected account balance is below $0 on purchase date."
          : "Projected account balance stays above $0 on purchase date.",
      colorClass: projected < 0 ? "text-ws-red" : "text-ws-charcoal",
    };
  }

  if (intent.intentType === "big_goal") {
    return {
      label: "Safe budget today",
      value: formatCurrency(simulation.maxSafeOneTimeSpend ?? 0),
      context: `Minimum safety cushion: ${simulation.targetBufferMonths} months`,
      colorClass: (simulation.maxSafeOneTimeSpend ?? 0) > 0 ? "text-ws-charcoal" : "text-ws-red",
    };
  }

  if (intent.intentType === "recurring") {
    return {
      label: "Monthly drag",
      value: `-${formatCurrency(Math.abs(simulation.recurringImpactMonthly ?? 0))}`,
      context: "Added monthly cost from this recurring expense.",
      colorClass: verdict === "risky" ? "text-ws-red" : "text-ws-yellow",
    };
  }

  const dipsBelowZero = simulation.freeCashAfter < 0;
  return {
    label: "Will your account dip below $0 before your next paycheck?",
    value: dipsBelowZero ? "Yes" : "No",
    context: dipsBelowZero
      ? "Account goes negative before your next paycheck."
      : "Account stays above $0 before your next paycheck.",
    colorClass: dipsBelowZero ? "text-ws-red" : "text-ws-green",
  };
}

function buildSecondaryMetric(
  intent: DecisionIntent,
  simulation: DecisionSimulationV2
): MetricTileData {
  if (intent.intentType === "big_goal") {
    if (simulation.monthsToGoal && simulation.monthlySavingsNeeded) {
      return {
        label: "Safe plan",
        value: `${formatCurrency(simulation.monthlySavingsNeeded)}/month for ${simulation.monthsToGoal} months`,
        context: `To safely afford ${formatCurrency(intent.amount)} while keeping a minimum safety cushion of ${simulation.targetBufferMonths} months.`,
        colorClass: "text-ws-charcoal",
      };
    }

    return {
      label: "Safe plan",
      value: "No safe monthly path yet",
      context: "Current monthly surplus cannot support this goal safely.",
      colorClass: "text-ws-red",
    };
  }

  if (intent.intentType === "recurring") {
    const nextSurplus = simulation.newPotentialSurplus ?? 0;
    return {
      label: "New monthly surplus",
      value: formatSignedCurrency(nextSurplus),
      context:
        nextSurplus < 0
          ? "This turns your monthly surplus negative."
          : "Monthly surplus stays positive after this recurring cost.",
      colorClass: nextSurplus < 0 ? "text-ws-red" : "text-ws-green",
    };
  }

  return {
    label: "Emergency cushion",
    value: `${simulation.bufferMonthsAfter.toFixed(1)} months`,
    context: `You could cover ${simulation.bufferMonthsAfter.toFixed(1)} months of essentials if income stopped. Minimum safety cushion: ${simulation.targetBufferMonths} months.`,
    colorClass:
      simulation.bufferMonthsAfter >= simulation.targetBufferMonths
        ? "text-ws-green"
        : simulation.bufferMonthsAfter >= 1
          ? "text-ws-yellow"
          : "text-ws-red",
  };
}
function buildAssumptions(
  parsed: ParsedDecisionIntentV2,
  intent: DecisionIntent,
  simulation: DecisionSimulationV2
): string[] {
  const assumptions: string[] = [];

  if (intent.intentType === "planned_purchase" && parsed.horizon.kind !== "date") {
    assumptions.push(`Timing interpreted as ${formatHorizonLabel(parsed.horizon)}`);
  }

  if (intent.intentType === "planned_purchase" && simulation.projectedDate) {
    assumptions.push(`Safe-date scan window is 120 days from target date`);
  }

  if (intent.intentType === "recurring" && parsed.cadence === "monthly") {
    assumptions.push("Recurring amount modeled in monthly terms");
  }

  return assumptions.slice(0, 2);
}

function formatSignedCurrency(value: number): string {
  return value < 0 ? `-${formatCurrency(Math.abs(value))}` : formatCurrency(value);
}

function formatHorizonLabel(horizon: TimeHorizon): string {
  if (horizon.kind === "today") return "today";
  if (horizon.kind === "this_week") return "this week";
  if (horizon.kind === "this_month") return "this month";
  if (horizon.kind === "date") return String(horizon.value);
  return `in ${horizon.value} days`;
}

function getTodayISO(snapshot: CashflowSnapshot): string {
  const withDate = snapshot as CashflowSnapshot & {
    snapshotDate?: string;
    snapshotDateISO?: string;
    latestTransactionDate?: string;
    latestTransactionDateISO?: string;
  };

  const candidate =
    withDate.snapshotDate ??
    withDate.snapshotDateISO ??
    withDate.latestTransactionDateISO ??
    withDate.latestTransactionDate;
  if (typeof candidate === "string" && ISO_DATE_RE.test(candidate)) {
    return candidate;
  }

  const now = new Date();
  const utc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  return utc.toISOString().slice(0, 10);
}

function buildDivergenceData(
  intent: DecisionIntent,
  simulation: DecisionSimulationV2,
  snapshot: CashflowSnapshot
): DivergenceForkData | null {
  if (intent.intentType === "big_goal") {
    return null;
  }

  if (intent.intentType === "planned_purchase") {
    return projectPlannedDivergence(intent, simulation, snapshot);
  }

  const projection = projectDivergence(intent.amount, intent.cadence, snapshot);
  return {
    weeks: projection.weeks,
    baseline: projection.baseline,
    withDecision: projection.withSpend,
    deltaAt90Days: projection.deltaAt90Days,
    assumption: projection.assumption,
  };
}

function projectPlannedDivergence(
  intent: DecisionIntent,
  simulation: DecisionSimulationV2,
  snapshot: CashflowSnapshot
): DivergenceForkData {
  const weeklyContribution = Math.max(snapshot.potentialSurplus / 4, 0);
  const todayISO = getTodayISO(snapshot);

  const daysUntilPurchase = simulation.projectedDate
    ? diffDaysISO(todayISO, simulation.projectedDate)
    : 0;

  const hitWeekRaw = Math.floor(daysUntilPurchase / 7);
  const hitWeek =
    hitWeekRaw >= 0 && hitWeekRaw < DIVERGENCE_WEEKS ? hitWeekRaw : -1;

  const baseline: number[] = [];
  const withDecision: number[] = [];

  let baseAccum = 0;
  let altAccum = 0;

  for (let week = 0; week < DIVERGENCE_WEEKS; week++) {
    baseAccum += weeklyContribution;
    const baseVal = baseAccum * (1 + WEEKLY_RATE * (week + 1));
    baseline.push(clampMoney(baseVal));

    const reduction =
      week === hitWeek ? Math.min(intent.amount, weeklyContribution) : 0;
    altAccum += Math.max(weeklyContribution - reduction, 0);
    const altVal = altAccum * (1 + WEEKLY_RATE * (week + 1));
    withDecision.push(clampMoney(altVal));
  }

  const deltaAt90Days = clampMoney(
    baseline[DIVERGENCE_WEEKS - 1] - withDecision[DIVERGENCE_WEEKS - 1]
  );

  return {
    weeks: DIVERGENCE_WEEKS,
    baseline,
    withDecision,
    deltaAt90Days,
    assumption:
      hitWeek >= 0
        ? `Assumes one-time hit in ~${daysUntilPurchase} days`
        : "Assumes purchase happens after the 90-day window",
  };
}

