"use client";

import type { HabitCandidate, HabitIntensity } from "@/lib/types";
import { buildGoalOptions, getReductionPercentForIntensity } from "@/lib/habits/goal-options";
import {
  generateBehaviorInsight,
  type GoalBehaviorData,
} from "@/lib/habits/generate-behavior-insight";
import { formatCurrency } from "@/lib/utils";

interface GoalStepProps {
  habit: HabitCandidate;
  intensity: HabitIntensity;
  setIntensity: (v: HabitIntensity) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function GoalStep({
  habit,
  intensity,
  setIntensity,
  onBack,
  onContinue,
}: GoalStepProps) {
  const monthly = habit.metrics.monthlySpend;
  const options = buildGoalOptions(habit);
  const selectedReduction = getReductionPercentForIntensity(habit, intensity);

  const goalData: GoalBehaviorData = {
    habitName: habit.name,
    category: habit.category,
    monthlySpend: habit.metrics.monthlySpend,
    weeklyFrequency: habit.metrics.weeklyFrequency,
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-ws-charcoal">
        Tie Yourself to the Mast
      </h1>
      <p className="text-sm text-ws-grey mt-2">
        Choose how aggressively you want to tackle this habit.
      </p>
      <p className="text-sm text-ws-charcoal mt-4">
        You&apos;ve spent{" "}
        <span className="font-bold">
          {formatCurrency(habit.metrics.totalSpentAllTime)}
        </span>{" "}
        on {habit.name} in the last {habit.metrics.monthsActive} months.
        Here&apos;s what you could save:
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {options.map((opt) => {
          const selected = intensity === opt.value;
          const savingsMonthly = monthly * (opt.reductionPercent / 100);
          const savingsYearly = savingsMonthly * 12;

          return (
            <button
              key={opt.value}
              onClick={() => setIntensity(opt.value)}
              className={`relative text-left bg-ws-white rounded-[8px] p-4 border-2 cursor-pointer transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-charcoal ${
                selected
                  ? "border-ws-charcoal shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
                  : "border-ws-border shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:border-ws-charcoal/40 hover:bg-ws-off-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
              }`}
            >
              {opt.recommended && (
                <span className="absolute top-3 right-3 text-[10px] font-bold text-ws-green bg-green-50 rounded-[72px] px-2 py-0.5">
                  Recommended
                </span>
              )}
              <p className="text-sm font-bold text-ws-charcoal">{opt.title}</p>
              <p className="text-lg font-bold text-ws-green mt-1">
                {formatCurrency(savingsMonthly)}
                <span className="text-xs font-normal text-ws-grey">/mo</span>
                <span className="text-xs font-normal text-ws-grey ml-2">
                  &middot; {formatCurrency(savingsYearly)}/yr
                </span>
              </p>
              <p className="text-xs text-ws-grey mt-1">{opt.description}</p>
            </button>
          );
        })}
      </div>

      <OdysseusInsight goalData={goalData} selectedReduction={selectedReduction} />

      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="flex-1 text-sm font-bold text-ws-charcoal bg-ws-light-grey rounded-[72px] py-3 hover:opacity-80 transition-opacity"
        >
          Back
        </button>
        <button
          onClick={onContinue}
          className="flex-1 text-sm font-bold text-white bg-ws-charcoal rounded-[72px] py-3 hover:opacity-90 transition-opacity"
        >
          Commit to Goal
        </button>
      </div>
    </div>
  );
}

function OdysseusInsight({
  goalData,
  selectedReduction,
}: {
  goalData: GoalBehaviorData;
  selectedReduction: number;
}) {
  const { body, kicker } = generateBehaviorInsight(goalData, selectedReduction);

  return (
    <div className="mt-4 bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">&#10024;</span>
        <p className="text-[10px] text-ws-grey uppercase tracking-wide font-medium">
          Odysseus Insight
        </p>
      </div>
      <p className="text-sm text-ws-charcoal leading-relaxed">{body}</p>
      <p className="text-xs text-ws-green mt-2 italic leading-relaxed">{kicker}</p>
    </div>
  );
}
