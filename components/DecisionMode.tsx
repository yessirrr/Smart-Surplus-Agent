"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { formatCurrency } from "@/lib/utils";
import { simulateDecision, projectDivergence } from "@/lib/domain/decision-simulator";
import { useAgent } from "@/lib/agent/use-agent";
import type { CashflowSnapshot } from "@/lib/domain/cashflow-model";
import type { DecisionSimulation, DivergenceProjection } from "@/lib/domain/decision-simulator";
import type { DecisionExplanationResult } from "@/lib/agent/skills/decision-explanation";
import type { DecisionIntent, SpendCadence } from "@/lib/agent/skills/intent-parser";

const REASON_LABELS: Record<string, string> = {
  fully_covered: "fully covered by free cash",
  surplus_negative: "surplus goes negative",
  buffer_low: "buffer below 1 month",
  buffer_critical: "buffer critically low",
  free_cash_negative: "short on cash before payday",
  investment_disrupted: "investment contribution at risk",
  streak_broken: "commitment streak impacted",
};

const VERDICT_CONFIG = {
  safe: { color: "text-ws-green", bg: "bg-ws-green", label: "Safe" },
  tight: { color: "text-ws-yellow", bg: "bg-ws-yellow", label: "Tight" },
  risky: { color: "text-ws-red", bg: "bg-ws-red", label: "Risky" },
} as const;

const CADENCE_LABELS: Record<string, string> = {
  one_time: "One-time",
  weekly: "Weekly",
  monthly: "Monthly",
};

type Phase = "idle" | "parsing" | "clarifying" | "result";

interface DecisionModeProps {
  snapshot: CashflowSnapshot;
}

export function DecisionMode({ snapshot }: DecisionModeProps) {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [intent, setIntent] = useState<DecisionIntent | null>(null);
  const [simulation, setSimulation] = useState<DecisionSimulation | null>(null);
  const [projection, setProjection] = useState<DivergenceProjection | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const abortRef = useRef<AbortController | undefined>(undefined);

  // Clarification state
  const [clarifyAmount, setClarifyAmount] = useState("");
  const [clarifyCadence, setClarifyCadence] = useState<SpendCadence | null>(null);

  const {
    data: explanation,
    loading: explanationLoading,
    generate: fetchExplanation,
  } = useAgent<DecisionExplanationResult>("/api/agent/decision");

  const runSimulation = useCallback(
    (amount: number, cadence: SpendCadence, horizon: DecisionIntent["horizon"]) => {
      const sim = simulateDecision(amount, snapshot);
      const proj = projectDivergence(amount, cadence, snapshot);
      setSimulation(sim);
      setProjection(proj);
      setPhase("result");
      setShowReasoning(false);

      fetchExplanation({
        proposedAmount: amount,
        verdict: sim.verdict,
        verdictReasons: sim.verdictReasons,
        freeCashBefore: snapshot.freeCashUntilPay,
        freeCashAfter: sim.newFreeCash,
        daysUntilPay: snapshot.daysUntilNextPay,
        surplusBefore: snapshot.currentSurplus,
        surplusAfter: sim.newMonthlySurplus,
        bufferMonths: sim.bufferMonths,
        investmentAtRisk: sim.investmentAtRisk,
        streakAtRisk: sim.streakAtRisk,
        cadence,
        horizon,
        deltaAt90Days: proj.deltaAt90Days,
        assumption: proj.assumption,
      });
    },
    [snapshot, fetchExplanation]
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Cancel any in-flight parse
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("parsing");
    setIntent(null);
    setSimulation(null);
    setProjection(null);

    try {
      const res = await fetch("/api/decision/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Parse failed");
      const parsed = (await res.json()) as DecisionIntent;

      if (controller.signal.aborted) return;

      setIntent(parsed);

      if (parsed.needsClarification || parsed.amount === null) {
        setClarifyAmount(parsed.amount !== null ? String(parsed.amount) : "");
        setClarifyCadence(parsed.cadence);
        setPhase("clarifying");
        return;
      }

      // All resolved — run simulation
      runSimulation(
        parsed.amount,
        parsed.cadence ?? "one_time",
        parsed.horizon
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPhase("idle");
    }
  }, [input, runSimulation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSubmit();
    },
    [handleSubmit]
  );

  const handleClarifySubmit = useCallback(() => {
    const amount = clarifyAmount ? parseFloat(clarifyAmount) : intent?.amount;
    if (!amount || amount <= 0) return;

    const cadence = clarifyCadence ?? intent?.cadence ?? "one_time";
    runSimulation(amount, cadence, intent?.horizon ?? "this_week");
  }, [clarifyAmount, clarifyCadence, intent, runSimulation]);

  const handleReset = useCallback(() => {
    setInput("");
    setPhase("idle");
    setIntent(null);
    setSimulation(null);
    setProjection(null);
    setShowReasoning(false);
  }, []);

  const resolvedCadence = intent?.cadence ?? clarifyCadence ?? "one_time";

  return (
    <div className="bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5">
      {/* Title */}
      <p className="text-sm font-bold text-ws-charcoal">Decision Mode</p>
      <p className="text-xs text-ws-grey mt-1">Ask Odysseus before you spend</p>

      {/* Input row */}
      <div className="flex items-center gap-3 mt-4">
        <div className="flex-1 border-b border-ws-border pb-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. $80 dinner tonight"
            disabled={phase === "parsing"}
            className="w-full text-sm text-ws-charcoal bg-transparent outline-none placeholder:text-ws-light-grey disabled:opacity-50"
          />
        </div>
        {phase === "idle" || phase === "parsing" ? (
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || phase === "parsing"}
            className="px-4 py-2 rounded-[72px] bg-ws-charcoal text-white text-sm font-bold transition-opacity disabled:opacity-30"
          >
            {phase === "parsing" ? "..." : "Check"}
          </button>
        ) : (
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-[72px] bg-ws-off-white text-ws-charcoal text-sm font-bold"
          >
            Clear
          </button>
        )}
      </div>

      {/* Clarification phase */}
      <AnimatePresence>
        {phase === "clarifying" && intent && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              <p className="text-sm text-ws-charcoal">
                {intent.clarificationQuestion ?? "How much are you considering spending?"}
              </p>

              {/* Amount clarification */}
              {intent.amount === null && (
                <div className="flex items-center gap-1 border-b border-ws-border pb-1 mt-3">
                  <span className="text-lg font-bold text-ws-charcoal">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={clarifyAmount}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                      const parts = cleaned.split(".");
                      setClarifyAmount(
                        parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned
                      );
                    }}
                    placeholder="0"
                    className="flex-1 text-lg font-bold text-ws-charcoal tabular-nums bg-transparent outline-none placeholder:text-ws-light-grey"
                  />
                </div>
              )}

              {/* Cadence clarification */}
              {intent.cadence === null && (
                <div className="flex gap-2 mt-3">
                  {(["one_time", "monthly"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setClarifyCadence(c)}
                      className={`px-3 py-1.5 rounded-[72px] text-xs font-bold transition-colors ${
                        clarifyCadence === c
                          ? "bg-ws-charcoal text-white"
                          : "bg-ws-off-white text-ws-grey"
                      }`}
                    >
                      {CADENCE_LABELS[c]}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={handleClarifySubmit}
                disabled={
                  (intent.amount === null && (!clarifyAmount || parseFloat(clarifyAmount) <= 0)) ||
                  (intent.cadence === null && clarifyCadence === null)
                }
                className="mt-4 px-4 py-2 rounded-[72px] bg-ws-charcoal text-white text-sm font-bold transition-opacity disabled:opacity-30"
              >
                Check
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result phase */}
      <AnimatePresence>
        {phase === "result" && simulation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="pt-5">
              {/* Cadence chip */}
              {resolvedCadence !== "one_time" && (
                <div className="flex justify-center mb-2">
                  <span className="text-[10px] text-ws-grey bg-ws-off-white rounded-[72px] px-2 py-0.5">
                    {projection?.assumption}
                  </span>
                </div>
              )}

              {/* Verdict */}
              <VerdictIndicator
                verdict={simulation.verdict}
                headline={explanation?.headline}
                loading={explanationLoading}
              />

              {/* Impact indicators */}
              <ImpactGrid simulation={simulation} snapshot={snapshot} />

              {/* Divergence fork visualization */}
              {projection && projection.deltaAt90Days > 0 && (
                <DivergenceFork projection={projection} />
              )}

              {/* AI explanation */}
              <div className="mt-4">
                {explanationLoading && <ExplanationSkeleton />}
                {!explanationLoading && explanation && (
                  <>
                    <p className="text-sm text-ws-charcoal leading-relaxed">
                      {explanation.explanation}
                    </p>
                    <p className="text-xs text-ws-grey italic mt-1">
                      {explanation.suggestion}
                    </p>
                  </>
                )}
              </div>

              {/* Show reasoning toggle */}
              <div className="mt-3">
                <button
                  onClick={() => setShowReasoning((v) => !v)}
                  className="text-[10px] text-ws-grey underline cursor-pointer"
                >
                  {showReasoning ? "Hide reasoning" : "Show reasoning"}
                </button>
                <AnimatePresence>
                  {showReasoning && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-ws-off-white rounded-[6px] px-3 py-2 mt-2">
                        <p className="text-[10px] text-ws-grey">
                          Factors:{" "}
                          {simulation.verdictReasons
                            .map((r) => REASON_LABELS[r] ?? r)
                            .join(", ")}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function VerdictIndicator({
  verdict,
  headline,
  loading,
}: {
  verdict: "safe" | "tight" | "risky";
  headline?: string;
  loading: boolean;
}) {
  const config = VERDICT_CONFIG[verdict];
  return (
    <motion.div
      key={verdict}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="flex flex-col items-center py-4"
    >
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${config.bg}`} />
        <span className={`text-xl font-bold ${config.color}`}>
          {config.label}
        </span>
      </div>
      <div className="mt-1 min-h-[20px]">
        {loading && (
          <div className="w-32 h-3 bg-ws-light-grey rounded animate-pulse" />
        )}
        {!loading && headline && (
          <p className="text-sm text-ws-grey">{headline}</p>
        )}
      </div>
    </motion.div>
  );
}

function ImpactGrid({
  simulation,
  snapshot,
}: {
  simulation: DecisionSimulation;
  snapshot: CashflowSnapshot;
}) {
  const surplusColor = simulation.surplusStillPositive
    ? "text-ws-charcoal"
    : "text-ws-red";

  const freeCashColor =
    simulation.newFreeCash < 0
      ? "text-ws-red"
      : simulation.newFreeCash < snapshot.dailyBurnRate * 3
        ? "text-ws-yellow"
        : "text-ws-green";

  const bufferColor =
    simulation.bufferMonths >= 2
      ? "text-ws-green"
      : simulation.bufferMonths >= 1
        ? "text-ws-yellow"
        : "text-ws-red";

  const indicators = [
    {
      label: "Surplus Impact",
      value:
        simulation.freeCashDelta < 0
          ? `-${formatCurrency(Math.abs(simulation.freeCashDelta))}`
          : formatCurrency(simulation.freeCashDelta),
      color: surplusColor,
      context: "this month",
    },
    {
      label: "Free Cash",
      value:
        simulation.newFreeCash < 0
          ? `-${formatCurrency(Math.abs(simulation.newFreeCash))}`
          : formatCurrency(simulation.newFreeCash),
      color: freeCashColor,
      context: `${snapshot.daysUntilNextPay} days until payday`,
    },
    {
      label: "Buffer",
      value: `${simulation.bufferMonths.toFixed(1)} months`,
      color: bufferColor,
      context: "of essentials",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mt-4">
      {indicators.map((ind, i) => (
        <motion.div
          key={ind.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.1 }}
          className="text-center"
        >
          <p className="text-[10px] text-ws-grey uppercase tracking-wide">
            {ind.label}
          </p>
          <p className={`text-sm font-bold mt-1 tabular-nums ${ind.color}`}>
            {ind.value}
          </p>
          <p className="text-[10px] text-ws-grey mt-0.5">{ind.context}</p>
        </motion.div>
      ))}
    </div>
  );
}

function ExplanationSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="w-full h-3 bg-ws-light-grey rounded" />
      <div className="w-4/5 h-3 bg-ws-light-grey rounded mt-2" />
    </div>
  );
}

// ── Divergence Fork SVG ──────────────────────────────────────

const SVG_W = 300;
const SVG_H = 140;
const PAD_L = 32;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 28;

function DivergenceFork({ projection }: { projection: DivergenceProjection }) {
  const { baseline, withSpend, weeks, deltaAt90Days } = projection;

  // Scale values to SVG coordinates
  const allValues = [...baseline, ...withSpend];
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
  const spendPath = buildPath(withSpend);

  const endX = toX(weeks - 1);
  const baseEndY = toY(baseline[weeks - 1]);
  const spendEndY = toY(withSpend[weeks - 1]);
  const gapMidY = (baseEndY + spendEndY) / 2;

  // Total path length estimate for animation
  const pathLen = plotW * 1.2;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="mt-4"
    >
      <p className="text-[10px] text-ws-grey uppercase tracking-wide mb-1">
        90-day portfolio divergence
      </p>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full"
        role="img"
        aria-label={`Portfolio divergence: $${Math.round(deltaAt90Days)} difference over 90 days`}
      >
        {/* Baseline path — draws first */}
        <motion.path
          d={baselinePath}
          fill="none"
          stroke="#0b8a3e"
          strokeWidth={2}
          strokeLinecap="round"
          initial={{ strokeDasharray: pathLen, strokeDashoffset: pathLen }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />

        {/* With-spend path — draws second */}
        <motion.path
          d={spendPath}
          fill="none"
          stroke="#c49b3c"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="4 3"
          initial={{ strokeDasharray: `4 3`, strokeDashoffset: pathLen }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
        />

        {/* Gap bracket line */}
        <motion.line
          x1={endX + 6}
          y1={baseEndY}
          x2={endX + 6}
          y2={spendEndY}
          stroke="rgba(50,48,47,0.2)"
          strokeWidth={1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.3 }}
        />

        {/* Delta text — lands last */}
        <motion.text
          x={endX + 12}
          y={gapMidY + 4}
          fill="rgb(50,48,47)"
          fontSize={10}
          fontWeight={700}
          fontFamily="Inter, sans-serif"
          initial={{ opacity: 0, x: endX + 20 }}
          animate={{ opacity: 1, x: endX + 12 }}
          transition={{ delay: 1.8, duration: 0.4 }}
        >
          -${Math.round(deltaAt90Days)}
        </motion.text>

        {/* Week labels */}
        <text x={PAD_L} y={SVG_H - 4} fill="rgb(104,102,100)" fontSize={8}>
          Week 1
        </text>
        <text x={endX - 20} y={SVG_H - 4} fill="rgb(104,102,100)" fontSize={8}>
          Week {weeks}
        </text>

        {/* Legend dots */}
        <circle cx={PAD_L} cy={SVG_H - 16} r={3} fill="#0b8a3e" />
        <text x={PAD_L + 6} y={SVG_H - 13} fill="rgb(104,102,100)" fontSize={7}>
          Baseline
        </text>
        <circle cx={PAD_L + 52} cy={SVG_H - 16} r={3} fill="#c49b3c" />
        <text x={PAD_L + 58} y={SVG_H - 13} fill="rgb(104,102,100)" fontSize={7}>
          With spend
        </text>
      </svg>
    </motion.div>
  );
}
