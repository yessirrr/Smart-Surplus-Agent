"use client";

import type { HabitCandidate, HabitIntensity } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface GoalStepProps {
  habit: HabitCandidate;
  intensity: HabitIntensity;
  setIntensity: (v: HabitIntensity) => void;
  onBack: () => void;
  onContinue: () => void;
}

const VICE_CATEGORIES = new Set(["vaping", "personal_vices"]);

export function GoalStep({
  habit,
  intensity,
  setIntensity,
  onBack,
  onContinue,
}: GoalStepProps) {
  const monthly = habit.metrics.monthlySpend;
  const isVice = VICE_CATEGORIES.has(habit.category);

  const options: Array<{
    value: HabitIntensity;
    title: string;
    description: string;
    multiplier: number;
    recommended?: boolean;
  }> = [
    {
      value: "gentle",
      title: "Reduce by 25%",
      description: "Small changes, sustainable pace",
      multiplier: 0.25,
    },
    {
      value: "standard",
      title: "Reduce by 50%",
      description: "Meaningful reduction, balanced approach",
      multiplier: 0.5,
      recommended: true,
    },
    {
      value: "strict",
      title: isVice ? "Eliminate completely" : "Reduce by 75%",
      description: "Maximum commitment, maximum savings",
      multiplier: isVice ? 1 : 0.75,
    },
  ];

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
          const savingsMonthly = monthly * opt.multiplier;
          const savingsYearly = savingsMonthly * 12;

          return (
            <button
              key={opt.value}
              onClick={() => setIntensity(opt.value)}
              className={`relative text-left bg-ws-white rounded-[8px] p-4 transition-all ${
                selected
                  ? "border-2 border-ws-charcoal shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
                  : "border border-ws-border shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
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
