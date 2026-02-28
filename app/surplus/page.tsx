"use client";

import { useMemo } from "react";
import Link from "next/link";
import transactions from "@/data/transactions.json";
import type { Transaction } from "@/lib/types";
import { analyzeTransactions } from "@/lib/domain";
import { SurplusHero } from "@/components/surplus/SurplusHero";
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

  const { surplusSummary, habitCandidates } = analysis;

  const monthlySavings =
    surplusSummary.averageMonthlyPotentialSurplus -
    surplusSummary.averageMonthlySurplus;

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
          <SurplusHero summary={surplusSummary} />
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
          <AllocationPicker monthlySavings={monthlySavings} />
        </div>
      </div>
    </div>
  );
}
