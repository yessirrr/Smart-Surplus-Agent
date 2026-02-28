"use client";

import Link from "next/link";
import type { HabitCandidate, HabitIntensity } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface SummaryStepProps {
  habit: HabitCandidate;
  intensity: HabitIntensity;
  confirmedCount: number;
}

const VICE_CATEGORIES = new Set(["vaping", "personal_vices"]);

const INTENSITY_LABELS: Record<HabitIntensity, string> = {
  gentle: "Gentle",
  standard: "Standard",
  strict: "Strict",
};

function getMultiplier(intensity: HabitIntensity, isVice: boolean): number {
  if (intensity === "gentle") return 0.25;
  if (intensity === "standard") return 0.5;
  return isVice ? 1 : 0.75;
}

export function SummaryStep({
  habit,
  intensity,
  confirmedCount,
}: SummaryStepProps) {
  const isVice = VICE_CATEGORIES.has(habit.category);
  const multiplier = getMultiplier(intensity, isVice);
  const monthlySavings = habit.metrics.monthlySpend * multiplier;
  const yearlySavings = monthlySavings * 12;
  const targetSpend = habit.metrics.monthlySpend - monthlySavings;

  // Bar width percentages
  const currentPct = 100;
  const targetPct = Math.max(
    5,
    ((habit.metrics.monthlySpend - monthlySavings) / habit.metrics.monthlySpend) * 100
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-ws-charcoal">
        Your Commitment is Set
      </h1>

      <div className="mt-6 bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-6">
        {/* Habit + intensity */}
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-ws-charcoal">{habit.name}</p>
          <span className="text-[10px] font-bold text-ws-grey bg-ws-light-grey rounded-[72px] px-2 py-0.5">
            {INTENSITY_LABELS[intensity]}
          </span>
        </div>

        {/* Monthly savings — hero number */}
        <p className="text-3xl font-bold text-ws-green mt-4">
          {formatCurrency(monthlySavings)}
          <span className="text-sm font-normal text-ws-grey">/month</span>
        </p>
        <p className="text-sm text-ws-grey mt-1">
          {formatCurrency(yearlySavings)} per year
        </p>

        {/* Investment hook */}
        <p className="text-sm text-ws-charcoal mt-4">
          That&apos;s enough to invest{" "}
          <span className="font-bold text-ws-green">
            {formatCurrency(yearlySavings)}
          </span>{" "}
          per year
        </p>

        {/* Confirmed stats */}
        <p className="text-xs text-ws-grey mt-4">
          {confirmedCount} transactions across {habit.merchants.length} merchants
        </p>

        {/* Spend bar */}
        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-ws-grey mb-1">
            <span>Current: {formatCurrency(habit.metrics.monthlySpend)}/mo</span>
            <span>Target: {formatCurrency(targetSpend)}/mo</span>
          </div>
          <div className="h-2 bg-ws-light-grey rounded-full overflow-hidden relative">
            <div
              className="absolute inset-y-0 left-0 bg-ws-red/30 rounded-full"
              style={{ width: `${currentPct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-ws-green rounded-full transition-all"
              style={{ width: `${targetPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mt-6">
        <Link
          href="/"
          className="flex-1 text-center text-sm font-bold text-ws-charcoal bg-ws-light-grey rounded-[72px] py-3 hover:opacity-80 transition-opacity"
        >
          Back to Dashboard
        </Link>
        <Link
          href="/surplus"
          className="flex-1 text-center text-sm font-bold text-white bg-ws-charcoal rounded-[72px] py-3 hover:opacity-90 transition-opacity"
        >
          View Surplus Plan
        </Link>
      </div>

      {/* Compliance disclaimer */}
      <p className="text-[10px] text-ws-grey text-center mt-8 leading-relaxed">
        This is not investment advice. Odysseus helps you understand your
        spending patterns and set personal goals. All investment decisions
        require your explicit confirmation.
      </p>
    </div>
  );
}
