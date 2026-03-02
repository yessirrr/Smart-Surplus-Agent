"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { formatCurrency } from "@/lib/utils";
import { simulateDecision } from "@/lib/domain/decision-simulator";
import { useAgent } from "@/lib/agent/use-agent";
import type { CashflowSnapshot } from "@/lib/domain/cashflow-model";
import type { DecisionSimulation } from "@/lib/domain/decision-simulator";
import type { DecisionExplanationResult } from "@/lib/agent/skills/decision-explanation";

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

interface DecisionModeProps {
  snapshot: CashflowSnapshot;
}

export function DecisionMode({ snapshot }: DecisionModeProps) {
  const [amount, setAmount] = useState("");
  const [simulation, setSimulation] = useState<DecisionSimulation | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  const {
    data: explanation,
    loading: explanationLoading,
    generate: fetchExplanation,
  } = useAgent<DecisionExplanationResult>("/api/agent/decision");

  const handleAmountChange = useCallback((value: string) => {
    // Strip non-numeric except decimal point
    const cleaned = value.replace(/[^0-9.]/g, "");
    // Prevent multiple decimal points
    const parts = cleaned.split(".");
    const sanitized =
      parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned;
    setAmount(sanitized);
  }, []);

  const handleCheck = useCallback(() => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;

    const sim = simulateDecision(parsed, snapshot);
    setSimulation(sim);
    setExpanded(true);
    setShowReasoning(false);

    fetchExplanation({
      proposedAmount: parsed,
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
    });
  }, [amount, snapshot, fetchExplanation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleCheck();
    },
    [handleCheck]
  );

  const parsedAmount = parseFloat(amount);
  const isDisabled = !parsedAmount || parsedAmount <= 0;

  return (
    <div className="bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5">
      {/* Title */}
      <p className="text-sm font-bold text-ws-charcoal">Decision Mode</p>
      <p className="text-xs text-ws-grey mt-1">
        How much are you thinking of spending?
      </p>

      {/* Input row */}
      <div className="flex items-center gap-3 mt-4">
        <div className="flex-1 flex items-center gap-1 border-b border-ws-border pb-1">
          <span className="text-lg font-bold text-ws-charcoal">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="0"
            className="flex-1 text-lg font-bold text-ws-charcoal tabular-nums bg-transparent outline-none placeholder:text-ws-light-grey"
          />
        </div>
        <button
          onClick={handleCheck}
          disabled={isDisabled}
          className="px-4 py-2 rounded-[72px] bg-ws-charcoal text-white text-sm font-bold transition-opacity disabled:opacity-30"
        >
          Check
        </button>
      </div>

      {/* Expanded result */}
      <AnimatePresence>
        {expanded && simulation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="pt-5">
              {/* Verdict */}
              <VerdictIndicator
                verdict={simulation.verdict}
                headline={explanation?.headline}
                loading={explanationLoading}
              />

              {/* Impact indicators */}
              <ImpactGrid simulation={simulation} snapshot={snapshot} />

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
