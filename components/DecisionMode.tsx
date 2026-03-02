
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { formatCurrency } from "@/lib/utils";
import { useAgent } from "@/lib/agent/use-agent";
import type { CashflowSnapshot } from "@/lib/domain/cashflow-model";
import {
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
  FREE_CASH_NEGATIVE: "Free cash goes below zero before payday",
  BUFFER_LT_1: "Buffer drops below 1 month of essentials",
  BUFFER_LT_2: "Buffer drops below 2 months of essentials",
  FUTURE_DATE_EVAL: "Scenario evaluated at a future date",
  PROJECTED_CHEQUING_LOW: "Projected chequing balance is low at purchase time",
  GOAL_REQUIRES_PLANNING: "Goal needs a savings plan before purchasing",
  GAP_TO_SAFE_BUDGET: "Amount exceeds safe one-time budget",
  NO_SAVINGS_CAPACITY: "No monthly savings capacity detected",
  RECURRING_RAISES_BURN: "Recurring cost raises ongoing burn rate",
  SURPLUS_NEGATIVE: "Potential surplus turns negative",
};

const VERDICT_STYLE = {
  safe: {
    text: "text-ws-green",
    chip: "bg-[rgba(11,138,62,0.12)] text-ws-green border-[rgba(11,138,62,0.32)]",
    label: "Safe",
  },
  tight: {
    text: "text-ws-yellow",
    chip: "bg-[rgba(196,155,60,0.16)] text-ws-yellow border-[rgba(196,155,60,0.32)]",
    label: "Tight",
  },
  risky: {
    text: "text-ws-red",
    chip: "bg-[rgba(220,67,54,0.12)] text-ws-red border-[rgba(220,67,54,0.30)]",
    label: "Risky",
  },
} as const;

const CONFIDENCE_STYLE = {
  high: "bg-[rgba(11,138,62,0.12)] text-ws-green border-[rgba(11,138,62,0.32)]",
  medium: "bg-[rgba(196,155,60,0.16)] text-ws-yellow border-[rgba(196,155,60,0.32)]",
  low: "bg-[rgba(220,67,54,0.12)] text-ws-red border-[rgba(220,67,54,0.30)]",
} as const;

type Phase = "idle" | "parsing" | "clarifying" | "result";
type ClarifyDateMode = "today" | "this_week" | "this_month" | "date";

interface DecisionModeProps {
  snapshot: CashflowSnapshot;
}

interface DivergenceForkData {
  weeks: number;
  baseline: number[];
  withDecision: number[];
  deltaAt90Days: number;
  assumption: string;
}

interface PlanImpactView {
  label: string;
  value: string;
  context: string;
  colorClass: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DIVERGENCE_WEEKS = 12;
const WEEKLY_RATE = 0.07 / 52;

export function DecisionMode({ snapshot }: DecisionModeProps) {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const [parsedIntent, setParsedIntent] = useState<ParsedDecisionIntentV2 | null>(null);
  const [resolvedIntent, setResolvedIntent] = useState<DecisionIntent | null>(null);
  const [simulation, setSimulation] = useState<DecisionSimulationV2 | null>(null);
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

  const runScenario = useCallback(
    (parsed: ParsedDecisionIntentV2, clarificationUsed: boolean) => {
      const intent = toDomainIntent(parsed);
      const nextSimulation = simulateDecisionByIntent(intent, snapshot);
      const nextDivergence = buildDivergenceData(intent, nextSimulation, snapshot);

      setResolvedIntent(intent);
      setSimulation(nextSimulation);
      setDivergence(nextDivergence);
      setShowReasoning(false);
      setPhase("result");

      const daysUntilPurchase =
        intent.intentType === "planned_purchase" && nextSimulation.projectedDate
          ? diffDaysISO(getTodayISO(snapshot), nextSimulation.projectedDate)
          : null;

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
          projectedFreeCashAtPurchase:
            intent.intentType === "planned_purchase" ? nextSimulation.freeCashBefore : null,
          bufferAtPurchase:
            intent.intentType === "planned_purchase" ? nextSimulation.bufferMonthsAfter : null,
          recurringImpactMonthly:
            intent.intentType === "recurring"
              ? nextSimulation.recurringImpactMonthly ?? null
              : null,
          gapToSafeBudget:
            intent.intentType === "big_goal"
              ? clampMoney(Math.max(intent.amount - (nextSimulation.maxSafeOneTimeSpend ?? 0), 0))
              : null,
          monthsToGoal: nextSimulation.monthsToGoal ?? null,
          requiredMonthlySavings: nextSimulation.monthlySavingsNeeded ?? null,
          targetBufferMonths: 2,
          divergenceDelta90d: nextDivergence?.deltaAt90Days ?? null,
        },
        reasonCodes: nextSimulation.reasons,
        clarificationUsed,
        assumptions: buildAssumptions(parsed, intent),
      };

      fetchExplanation(payload as unknown as Record<string, unknown>);
    },
    [snapshot, fetchExplanation]
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
    setDivergence(null);
    setShowReasoning(false);
    setClarifyAmount("");
    setClarifyCadence(null);
    setClarifyDateMode("this_week");
    setClarifyDateValue("");
    setClarifyGoalName("");
    setClarifyBudgetCap("");
  }, []);

  const planImpact = useMemo(() => {
    if (!resolvedIntent || !simulation) {
      return null;
    }

    return buildPlanImpactView(resolvedIntent, simulation, snapshot);
  }, [resolvedIntent, simulation, snapshot]);

  const placeholder = PLACEHOLDERS[placeholderIndex];

  return (
    <section className="rounded-[16px] bg-gradient-to-b from-ws-white to-[rgba(245,244,240,0.75)] border border-ws-border p-5 sm:p-6">
      <div className="max-w-[760px] mx-auto">
        <p className="text-[11px] tracking-[0.12em] uppercase text-ws-grey">Decision Mode</p>
        <h3 className="text-[1.45rem] sm:text-[1.8rem] font-bold text-ws-charcoal mt-2 leading-tight">
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
              className="w-full bg-transparent text-sm sm:text-base text-ws-charcoal outline-none placeholder:text-ws-light-grey disabled:opacity-60"
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
              Parsing intent and building deterministic scenario...
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
                {parsedIntent.clarificationQuestion ?? "A quick detail to tighten the simulation:"}
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
          {phase === "result" && simulation && resolvedIntent && planImpact && (
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
                    className={`text-[11px] uppercase tracking-[0.08em] rounded-[72px] px-2.5 py-1 border ${VERDICT_STYLE[simulation.verdict].chip}`}
                  >
                    {VERDICT_STYLE[simulation.verdict].label}
                  </span>
                  <span
                    className={`text-[11px] uppercase tracking-[0.08em] rounded-[72px] px-2.5 py-1 border ${CONFIDENCE_STYLE[confidenceLabel]}`}
                  >
                    {confidenceLabel} confidence
                  </span>
                </div>

                <p className={`mt-4 text-[2rem] sm:text-[2.4rem] leading-none font-bold ${VERDICT_STYLE[simulation.verdict].text}`}>
                  {VERDICT_STYLE[simulation.verdict].label}
                </p>
                <p className="text-sm text-[rgba(255,255,255,0.84)] mt-2 min-h-[20px]">
                  {explanationLoading
                    ? "Generating decision beat..."
                    : explanation?.headline ?? "Deterministic scenario complete."}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <ImpactTile
                  label="Free cash"
                  value={formatSignedCurrency(simulation.freeCashAfter)}
                  context={`${simulation.daysUntilPay} days to payday`}
                  colorClass={
                    simulation.freeCashAfter < 0
                      ? "text-ws-red"
                      : simulation.freeCashAfter < snapshot.dailyBurnRate * 3
                        ? "text-ws-yellow"
                        : "text-ws-green"
                  }
                />
                <ImpactTile
                  label="Buffer"
                  value={`${simulation.bufferMonthsAfter.toFixed(1)} mo`}
                  context="of essentials"
                  colorClass={
                    simulation.bufferMonthsAfter >= 2
                      ? "text-ws-green"
                      : simulation.bufferMonthsAfter >= 1
                        ? "text-ws-yellow"
                        : "text-ws-red"
                  }
                />
                <ImpactTile
                  label={planImpact.label}
                  value={planImpact.value}
                  context={planImpact.context}
                  colorClass={planImpact.colorClass}
                />
              </div>

              {divergence && (
                <div className="mt-4 rounded-[12px] border border-ws-border bg-ws-white p-3 sm:p-4">
                  <DivergenceFork projection={divergence} />
                </div>
              )}

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
                  {showReasoning ? "Hide reasoning" : "Show reasoning"}
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
                          {simulation.reasons.map((r) => REASON_LABELS[r] ?? r).join(" | ")}
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

function ImpactTile({
  label,
  value,
  context,
  colorClass,
}: {
  label: string;
  value: string;
  context: string;
  colorClass: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-[12px] border border-ws-border bg-ws-white p-3"
    >
      <p className="text-[10px] uppercase tracking-wide text-ws-grey">{label}</p>
      <p className={`text-[1.2rem] font-bold tabular-nums mt-1 ${colorClass}`}>{value}</p>
      <p className="text-[11px] text-ws-grey mt-0.5">{context}</p>
    </motion.div>
  );
}

const SVG_W = 320;
const SVG_H = 150;
const PAD_L = 30;
const PAD_R = 22;
const PAD_T = 16;
const PAD_B = 30;

function DivergenceFork({ projection }: { projection: DivergenceForkData }) {
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

  function path(values: number[]): string {
    return values
      .map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`)
      .join(" ");
  }

  const basePath = path(baseline);
  const altPath = path(withDecision);
  const endX = toX(weeks - 1);
  const baseEndY = toY(baseline[weeks - 1]);
  const altEndY = toY(withDecision[weeks - 1]);
  const gapMid = (baseEndY + altEndY) / 2;
  const pathLen = plotW * 1.2;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <p className="text-[10px] uppercase tracking-wide text-ws-grey">90-day divergence</p>
      <p className="text-[11px] text-ws-grey mt-0.5">{assumption}</p>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full mt-2"
        role="img"
        aria-label={`90-day divergence of ${Math.round(deltaAt90Days)} dollars`}
      >
        <motion.path
          d={basePath}
          fill="none"
          stroke="#0b8a3e"
          strokeWidth={2}
          strokeLinecap="round"
          initial={{ strokeDasharray: pathLen, strokeDashoffset: pathLen }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />

        <motion.path
          d={altPath}
          fill="none"
          stroke="#c49b3c"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="4 4"
          initial={{ strokeDasharray: `4 4`, strokeDashoffset: pathLen }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
        />

        <motion.line
          x1={endX + 6}
          y1={baseEndY}
          x2={endX + 6}
          y2={altEndY}
          stroke="rgba(50,48,47,0.22)"
          strokeWidth={1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.25 }}
        />

        <motion.text
          x={endX + 12}
          y={gapMid + 4}
          fill="rgb(50,48,47)"
          fontSize={10}
          fontWeight={700}
          initial={{ opacity: 0, x: endX + 20 }}
          animate={{ opacity: 1, x: endX + 12 }}
          transition={{ delay: 1.65, duration: 0.3 }}
        >
          -{formatCurrency(Math.abs(deltaAt90Days))}
        </motion.text>

        <text x={PAD_L} y={SVG_H - 6} fill="rgb(104,102,100)" fontSize={9}>
          Week 1
        </text>
        <text x={endX - 22} y={SVG_H - 6} fill="rgb(104,102,100)" fontSize={9}>
          Week {weeks}
        </text>

        <circle cx={PAD_L} cy={SVG_H - 18} r={3} fill="#0b8a3e" />
        <text x={PAD_L + 7} y={SVG_H - 15} fill="rgb(104,102,100)" fontSize={8}>
          Baseline
        </text>

        <circle cx={PAD_L + 58} cy={SVG_H - 18} r={3} fill="#c49b3c" />
        <text x={PAD_L + 65} y={SVG_H - 15} fill="rgb(104,102,100)" fontSize={8}>
          With decision
        </text>
      </svg>
    </motion.div>
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

function buildPlanImpactView(
  intent: DecisionIntent,
  simulation: DecisionSimulationV2,
  snapshot: CashflowSnapshot
): PlanImpactView {
  if (intent.intentType === "recurring") {
    const drag = simulation.recurringImpactMonthly ?? 0;
    return {
      label: "Monthly drag",
      value: `-${formatCurrency(Math.abs(drag))}`,
      context: "added monthly spend",
      colorClass: drag > snapshot.potentialSurplus ? "text-ws-red" : "text-ws-yellow",
    };
  }

  if (intent.intentType === "big_goal") {
    if (simulation.monthlySavingsNeeded) {
      return {
        label: "Monthly needed",
        value: formatCurrency(simulation.monthlySavingsNeeded),
        context: simulation.monthsToGoal
          ? `${simulation.monthsToGoal} months to goal`
          : "to close safe-budget gap",
        colorClass: "text-ws-yellow",
      };
    }

    return {
      label: "Safe budget",
      value: formatCurrency(simulation.maxSafeOneTimeSpend ?? 0),
      context: "one-time spend cap now",
      colorClass: "text-ws-green",
    };
  }

  if (simulation.reasons.includes("FREE_CASH_NEGATIVE")) {
    return {
      label: "Plan impact",
      value: "At risk",
      context: "near-term cash turns negative",
      colorClass: "text-ws-red",
    };
  }

  return {
    label: "Surplus impact",
    value: `-${formatCurrency(intent.amount)}`,
    context:
      intent.intentType === "planned_purchase" && simulation.projectedDate
        ? `one-time on ${simulation.projectedDate}`
        : "one-time decision",
    colorClass: "text-ws-charcoal",
  };
}

function buildAssumptions(parsed: ParsedDecisionIntentV2, intent: DecisionIntent): string[] {
  const assumptions: string[] = [];

  if (intent.intentType === "planned_purchase" && parsed.horizon.kind !== "date") {
    assumptions.push(`Timing interpreted as ${formatHorizonLabel(parsed.horizon)}`);
  }

  if (intent.intentType === "recurring" && parsed.cadence === "monthly") {
    assumptions.push("Recurring amount modeled as monthly");
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
  };

  const candidate = withDate.snapshotDate ?? withDate.snapshotDateISO ?? withDate.latestTransactionDate;
  if (typeof candidate === "string" && ISO_DATE_RE.test(candidate)) {
    return candidate;
  }

  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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
  const hitWeek = hitWeekRaw >= 0 && hitWeekRaw < DIVERGENCE_WEEKS ? hitWeekRaw : -1;

  const baseline: number[] = [];
  const withDecision: number[] = [];

  let baseAccum = 0;
  let altAccum = 0;

  for (let week = 0; week < DIVERGENCE_WEEKS; week++) {
    baseAccum += weeklyContribution;
    const baseVal = baseAccum * (1 + WEEKLY_RATE * (week + 1));
    baseline.push(clampMoney(baseVal));

    const reduction = week === hitWeek ? Math.min(intent.amount, weeklyContribution) : 0;
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


