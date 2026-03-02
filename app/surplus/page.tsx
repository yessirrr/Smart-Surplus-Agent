"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import transactions from "@/data/transactions.json";
import type { Transaction } from "@/lib/types";
import { analyzeTransactions } from "@/lib/domain";
import { buildRecurringHabit } from "@/lib/utils/build-recurring-habit";
import { SurplusHero, formatMonthLabel } from "@/components/surplus/SurplusHero";
import { HabitToggleBar } from "@/components/surplus/HabitToggleBar";
import { SpendingBreakdown } from "@/components/surplus/SpendingBreakdown";
import { AllocationPicker } from "@/components/surplus/AllocationPicker";

export default function SurplusPage() {
  const txns = transactions as Transaction[];

  const analysis = useMemo(
    () =>
      analyzeTransactions(txns, {
        frequency: "biweekly",
        dayOfWeek: "friday",
        amount: 2076,
      }),
    [txns]
  );

  const { surplusSummary } = analysis;

  // Include synthetic recurring habit in candidates
  const habitCandidates = useMemo(() => {
    const recurring = buildRecurringHabit(analysis.recurringPatterns, txns);
    return recurring
      ? [...analysis.habitCandidates, recurring]
      : analysis.habitCandidates;
  }, [analysis, txns]);

  // Habit toggle state - all selected by default
  const [selectedHabitIds, setSelectedHabitIds] = useState<Set<string>>(
    () => new Set(habitCandidates.map((h) => h.id))
  );

  const toggleHabit = useCallback((id: string) => {
    setSelectedHabitIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllHabits = useCallback(() => {
    setSelectedHabitIds((prev) => {
      if (prev.size === habitCandidates.length) {
        return new Set<string>();
      }
      return new Set(habitCandidates.map((h) => h.id));
    });
  }, [habitCandidates]);

  // Pre-compute per-month spend for each habit (stable reference)
  const habitMonthlySpend = useMemo(() => {
    const result = new Map<string, Map<string, number>>();
    for (const habit of habitCandidates) {
      const txnIds = new Set(habit.transactionIds);
      const monthSpend = new Map<string, number>();
      for (const txn of txns) {
        if (!txnIds.has(txn.id)) continue;
        const month = txn.date.slice(0, 7);
        monthSpend.set(month, (monthSpend.get(month) ?? 0) + Math.abs(txn.amount));
      }
      result.set(habit.id, monthSpend);
    }
    return result;
  }, [habitCandidates, txns]);

  // Compute adjusted values based on selected habits
  const adjusted = useMemo(() => {
    const chartData = surplusSummary.periods.map((period) => {
      const month = period.periodStart.slice(0, 7);
      let selectedSpend = 0;
      for (const id of selectedHabitIds) {
        selectedSpend += habitMonthlySpend.get(id)?.get(month) ?? 0;
      }
      const actual = Math.round(period.surplus);
      const potential = Math.round(period.surplus + selectedSpend);

      return {
        month: formatMonthLabel(period.periodStart),
        actual,
        potential,
        actualNegative: actual < 0 ? actual : null,
      };
    });

    // Adjusted average potential
    const selectedHabits = habitCandidates.filter((h) =>
      selectedHabitIds.has(h.id)
    );
    const totalSelectedMonthly = selectedHabits.reduce(
      (s, h) => s + h.metrics.monthlySpend,
      0
    );
    const adjustedPotential =
      surplusSummary.averageMonthlySurplus + totalSelectedMonthly;
    const monthlySavings = totalSelectedMonthly;

    const selectedHabitsData = selectedHabits.map((h) => ({
      name: h.name,
      category: h.category,
      monthlySpend: h.metrics.monthlySpend,
    }));

    return { chartData, adjustedPotential, monthlySavings, selectedHabitsData };
  }, [selectedHabitIds, surplusSummary, habitCandidates, habitMonthlySpend]);

  return (
    <div className="min-h-screen bg-ws-off-white">
      <div className="mx-auto max-w-[654px] px-4 py-6">
        <Link
          href="/"
          className="text-sm text-ws-grey hover:text-ws-charcoal transition-colors"
        >
          &larr; Back to Dashboard
        </Link>

        <h1 className="text-xl font-bold text-ws-charcoal mt-4">
          Every Dollar Counts
        </h1>
        <p className="text-sm text-ws-grey mt-1">
          Here&apos;s what Odysseus found in 24 months of spending data.
        </p>

        {/* Section 1: Surplus Overview */}
        <div className="mt-6">
          <SurplusHero
            actualSurplus={surplusSummary.averageMonthlySurplus}
            adjustedPotentialSurplus={adjusted.adjustedPotential}
            chartData={adjusted.chartData}
            selectedHabits={adjusted.selectedHabitsData}
            totalMonthlySavings={adjusted.monthlySavings}
          />
        </div>

        {/* Habit toggles */}
        <div className="mt-4">
          <HabitToggleBar
            habits={habitCandidates}
            selectedIds={selectedHabitIds}
            onToggle={toggleHabit}
            onSelectAll={selectAllHabits}
          />
        </div>

        {/* Section 2: Spending Breakdown */}
        <div className="mt-8">
          <SpendingBreakdown
            summary={surplusSummary}
            habitCandidates={habitCandidates}
          />
        </div>

        {/* Section 3: Allocation Picker */}
        <div className="mt-8 pb-12">
          <AllocationPicker monthlySavings={adjusted.monthlySavings} />
        </div>
      </div>
    </div>
  );
}