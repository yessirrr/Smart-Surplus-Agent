"use client";

import { useEffect } from "react";
import type { HabitCandidate } from "@/lib/types";
import { useAgent, type HabitInsightResult } from "@/lib/agent";
import { CATEGORY_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

interface HabitSelectionStepProps {
  habits: HabitCandidate[];
  selectedHabitId: string | null;
  setSelectedHabitId: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function HabitSelectionStep({
  habits,
  selectedHabitId,
  setSelectedHabitId,
  onBack,
  onContinue,
}: HabitSelectionStepProps) {
  const {
    data: insight,
    loading: insightLoading,
    error: insightError,
    generate: fetchInsight,
  } = useAgent<HabitInsightResult>("/api/agent/habit-insight");

  useEffect(() => {
    if (selectedHabitId) {
      fetchInsight({ habitId: selectedHabitId });
    }
  }, [selectedHabitId, fetchInsight]);

  return (
    <div>
      <h1 className="text-xl font-bold text-ws-charcoal">
        Old Habits Die Hard
      </h1>
      <p className="text-sm text-ws-grey mt-2">
        Odysseus detected these spending habits. Pick one to tackle first.
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {habits.map((habit) => {
          const selected = habit.id === selectedHabitId;
          return (
            <button
              key={habit.id}
              onClick={() => setSelectedHabitId(habit.id)}
              className={`text-left bg-ws-white rounded-[8px] p-4 transition-all ${
                selected
                  ? "border-2 border-ws-charcoal shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
                  : "border border-ws-border shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-ws-charcoal">
                  {habit.name}
                </p>
                <span className="shrink-0 text-[10px] font-medium text-ws-grey bg-ws-light-grey rounded-[72px] px-2 py-0.5">
                  {CATEGORY_LABELS[habit.category] ?? habit.category}
                </span>
              </div>

              <p className="text-lg font-bold text-ws-red mt-2">
                {formatCurrency(habit.metrics.monthlySpend)}
                <span className="text-xs font-normal text-ws-grey">/mo</span>
              </p>
              <p className="text-xs text-ws-grey">
                {formatCurrency(habit.metrics.yearlyProjection)} per year
              </p>

              <div className="flex items-center gap-2 mt-3">
                <ConfidenceDot confidence={habit.confidence} />
                <span className="text-[10px] text-ws-grey">
                  {(habit.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>

              <p className="text-xs text-ws-grey mt-2 truncate">
                {habit.merchants.join(", ")}
              </p>
              <p className="text-[10px] text-ws-grey mt-1">
                {habit.transactionIds.length} transactions &middot;{" "}
                {habit.metrics.monthsActive} months
              </p>
            </button>
          );
        })}
      </div>

      {/* Odysseus Insight */}
      {selectedHabitId && (
        <div className="mt-4">
          {insightLoading && <InsightSkeleton />}
          {!insightLoading && insight && !insightError && (
            <div className="bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">&#10024;</span>
                <p className="text-[10px] text-ws-grey uppercase tracking-wide font-medium">
                  Odysseus Insight
                </p>
              </div>
              <p className="text-sm font-bold text-ws-charcoal">
                {insight.headline}
              </p>
              <p className="text-xs text-ws-grey mt-2 leading-relaxed">
                {insight.explanation}
              </p>
              <p className="text-xs text-ws-green mt-2 italic leading-relaxed">
                {insight.motivationalHook}
              </p>
              <div className="mt-3 bg-ws-off-white rounded-[6px] px-3 py-2">
                <p className="text-xs text-ws-charcoal">
                  {insight.actionSuggestion}
                </p>
              </div>
            </div>
          )}
          {!insightLoading && insightError && (
            <p className="text-xs text-ws-grey mt-2">Insight unavailable</p>
          )}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="flex-1 text-sm font-bold text-ws-charcoal bg-ws-light-grey rounded-[72px] py-3 hover:opacity-80 transition-opacity"
        >
          Back
        </button>
        <button
          onClick={onContinue}
          disabled={!selectedHabitId}
          className="flex-1 text-sm font-bold text-white bg-ws-charcoal rounded-[72px] py-3 transition-opacity disabled:opacity-40 hover:opacity-90"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function InsightSkeleton() {
  return (
    <div className="bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-4 h-4 bg-ws-light-grey rounded" />
        <div className="w-24 h-3 bg-ws-light-grey rounded" />
      </div>
      <div className="w-3/4 h-4 bg-ws-light-grey rounded" />
      <div className="w-full h-3 bg-ws-light-grey rounded mt-3" />
      <div className="w-5/6 h-3 bg-ws-light-grey rounded mt-1.5" />
      <div className="w-2/3 h-3 bg-ws-light-grey rounded mt-3" />
    </div>
  );
}

function ConfidenceDot({ confidence }: { confidence: number }) {
  const color =
    confidence > 0.8
      ? "bg-ws-green"
      : confidence > 0.6
        ? "bg-yellow-500"
        : "bg-ws-grey";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}
