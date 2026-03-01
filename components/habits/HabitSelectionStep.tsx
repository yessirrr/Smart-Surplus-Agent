"use client";

import type { HabitCandidate } from "@/lib/types";
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
                  : "border border-ws-border shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:border-ws-charcoal/30"
              }`}
            >
              <p className="text-sm font-bold text-ws-charcoal">
                {habit.name}
              </p>

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
            </button>
          );
        })}
      </div>

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

function ConfidenceDot({ confidence }: { confidence: number }) {
  const color =
    confidence > 0.8
      ? "bg-ws-green"
      : confidence > 0.6
        ? "bg-yellow-500"
        : "bg-ws-grey";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}
