"use client";

import type { HabitCandidate, HabitIntensity } from "@/lib/types";
import type { GoalInsightResult } from "@/lib/agent/skills/goal-insight";
import { formatCurrency } from "@/lib/utils";

interface GoalStepProps {
  habit: HabitCandidate;
  intensity: HabitIntensity;
  setIntensity: (v: HabitIntensity) => void;
  goalInsight: GoalInsightResult | null;
  goalInsightLoading: boolean;
  goalInsightError: string | null;
  onBack: () => void;
  onContinue: () => void;
}

const VICE_CATEGORIES = new Set(["vaping", "personal_vices"]);

const BEHAVIOR_UNITS: Record<string, string> = {
  food_delivery: "orders",
  coffee: "coffees",
  coffee_shops: "coffees",
  vaping: "purchases",
  alcohol: "purchases",
  dining_out: "meals out",
  impulse_shopping: "purchases",
  shopping: "purchases",
  rideshare: "rides",
  entertainment: "purchases",
  electronics: "purchases",
  transportation: "trips",
};

function formatFrequency(freq: number, unit: string): string {
  if (freq >= 3) {
    const low = Math.floor(freq);
    const high = Math.ceil(freq);
    if (low === high) return `${low} ${unit} per week`;
    return `${low}-${high} ${unit} per week`;
  }
  if (freq >= 1) {
    const low = Math.floor(freq);
    const high = Math.ceil(freq);
    if (low === high) return `${low} ${unit} per week`;
    return `${low}-${high} ${unit} per week`;
  }
  // Less than 1 per week — show monthly
  const monthly = freq * 4.33;
  const rounded = Math.round(monthly);
  return `${Math.max(1, rounded)} ${unit} per month`;
}

export function GoalStep({
  habit,
  intensity,
  setIntensity,
  goalInsight,
  goalInsightLoading,
  goalInsightError,
  onBack,
  onContinue,
}: GoalStepProps) {
  const monthly = habit.metrics.monthlySpend;
  const isVice = VICE_CATEGORIES.has(habit.category);
  const weeklyFreq = habit.metrics.weeklyFrequency;
  const unit = BEHAVIOR_UNITS[habit.category] ?? "times";
  const avgCost = weeklyFreq > 0 ? monthly / (weeklyFreq * 4.33) : 0;

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
          const newFreq = weeklyFreq * (1 - opt.multiplier);
          const isEliminate = opt.multiplier === 1;

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

              {/* Behavioral translation */}
              {weeklyFreq > 0 && (
                <>
                  <div className="border-t border-ws-border mt-3 pt-3">
                    <p className="text-[10px] text-ws-grey font-bold uppercase tracking-wide">
                      What this looks like:
                    </p>
                    <p className="text-sm text-ws-charcoal mt-1.5">
                      Now: ~{formatFrequency(weeklyFreq, unit)}
                    </p>
                    <p className="text-sm text-ws-green mt-0.5">
                      {isEliminate
                        ? `Target: None \u2014 fully eliminated`
                        : `Target: ~${formatFrequency(newFreq, unit)}`}
                    </p>
                    {avgCost > 0 && (
                      <p className="text-xs text-ws-grey mt-1">
                        ~{formatCurrency(avgCost)} per {unit.replace(/s$/, "")}
                      </p>
                    )}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Odysseus Insight */}
      <div className="mt-4">
        {goalInsightLoading && <InsightSkeleton />}
        {!goalInsightLoading && goalInsight && !goalInsightError && (
          <div className="bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">&#10024;</span>
              <p className="text-[10px] text-ws-grey uppercase tracking-wide font-medium">
                Odysseus Insight
              </p>
            </div>
            <p className="text-sm text-ws-charcoal leading-relaxed">
              {goalInsight.behaviorFraming}
            </p>
            <p className="text-xs text-ws-green mt-2 italic leading-relaxed">
              {goalInsight.motivationalNudge}
            </p>
            <p className="text-xs text-ws-grey mt-2 leading-relaxed">
              {goalInsight.investmentHook}
            </p>
          </div>
        )}
        {!goalInsightLoading && goalInsightError && (
          <p className="text-xs text-ws-grey mt-2">Insight unavailable</p>
        )}
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

function InsightSkeleton() {
  return (
    <div className="bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-4 h-4 bg-ws-light-grey rounded" />
        <div className="w-24 h-3 bg-ws-light-grey rounded" />
      </div>
      <div className="w-3/4 h-4 bg-ws-light-grey rounded" />
      <div className="w-full h-3 bg-ws-light-grey rounded mt-3" />
      <div className="w-2/3 h-3 bg-ws-light-grey rounded mt-3" />
    </div>
  );
}
