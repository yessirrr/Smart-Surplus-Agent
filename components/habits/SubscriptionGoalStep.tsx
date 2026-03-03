"use client";

import { useMemo } from "react";
import type { Transaction, HabitCandidate } from "@/lib/types";
import type { GoalInsightResult } from "@/lib/narrative/skills/goal-insight";
import { formatCurrency } from "@/lib/utils";

interface SubscriptionGoalStepProps {
  habit: HabitCandidate;
  allTransactions: Transaction[];
  canceledMerchants: Set<string>;
  setCanceledMerchants: (v: Set<string>) => void;
  selectedFund: string;
  setSelectedFund: (v: string) => void;
  goalInsight: GoalInsightResult | null;
  goalInsightLoading: boolean;
  goalInsightError: string | null;
  onBack: () => void;
  onContinue: () => void;
}

const FUND_OPTIONS = [
  "S&P 500 Index",
  "Tech Growth Fund",
  "Custom Allocation",
];

function computeFiveYear(monthlyAmount: number): number {
  if (monthlyAmount <= 0) return 0;
  const r = 0.07 / 12;
  const n = 60;
  return monthlyAmount * ((Math.pow(1 + r, n) - 1) / r);
}

export function SubscriptionGoalStep({
  habit,
  allTransactions,
  canceledMerchants,
  setCanceledMerchants,
  selectedFund,
  setSelectedFund,
  goalInsight,
  goalInsightLoading,
  goalInsightError,
  onBack,
  onContinue,
}: SubscriptionGoalStepProps) {
  // Derive individual subscription details from transaction data
  const subscriptions = useMemo(() => {
    const txnIds = new Set(habit.transactionIds);
    const matchingTxns = allTransactions.filter((t) => txnIds.has(t.id));

    // Group by merchant
    const merchantTotals = new Map<string, { total: number; count: number }>();
    for (const txn of matchingTxns) {
      const entry = merchantTotals.get(txn.merchant) ?? { total: 0, count: 0 };
      entry.total += Math.abs(txn.amount);
      entry.count += 1;
      merchantTotals.set(txn.merchant, entry);
    }

    // Compute monthly average per merchant
    const monthsActive = Math.max(habit.metrics.monthsActive, 1);
    return [...merchantTotals.entries()]
      .map(([merchant, { total, count }]) => ({
        merchant,
        monthlyCost: total / monthsActive,
        yearlyCost: (total / monthsActive) * 12,
        transactionCount: count,
      }))
      .sort((a, b) => b.monthlyCost - a.monthlyCost);
  }, [habit, allTransactions]);

  const freedMonthly = subscriptions
    .filter((s) => canceledMerchants.has(s.merchant))
    .reduce((sum, s) => sum + s.monthlyCost, 0);
  const canceledCount = canceledMerchants.size;
  const fiveYearValue = computeFiveYear(freedMonthly);

  function toggleCancel(merchant: string) {
    const next = new Set(canceledMerchants);
    if (next.has(merchant)) {
      next.delete(merchant);
    } else {
      next.add(merchant);
    }
    setCanceledMerchants(next);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-ws-charcoal">
        Cancel &amp; Reinvest
      </h1>
      <p className="text-sm text-ws-grey mt-2">
        Subscriptions are the easiest money to redirect. Cancel what you
        don&apos;t need, invest the difference automatically.
      </p>

      {/* Subscription list */}
      <div className="mt-6 bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] divide-y divide-ws-border overflow-hidden">
        {subscriptions.map((sub) => {
          const isCanceled = canceledMerchants.has(sub.merchant);
          return (
            <div
              key={sub.merchant}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-bold ${
                    isCanceled
                      ? "text-ws-grey line-through"
                      : "text-ws-charcoal"
                  }`}
                >
                  {sub.merchant}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      isCanceled ? "text-ws-green" : "text-ws-red"
                    }`}
                  >
                    {formatCurrency(sub.monthlyCost)}
                    <span className="text-xs font-normal text-ws-grey">
                      /mo
                    </span>
                  </p>
                  <span className="text-xs text-ws-grey">
                    &middot; {formatCurrency(sub.yearlyCost)}/yr
                  </span>
                  {isCanceled && (
                    <span className="text-[10px] font-medium text-ws-green">
                      &rarr; Reinvest
                    </span>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                <span className="text-xs text-ws-grey">Cancel</span>
                <input
                  type="checkbox"
                  checked={isCanceled}
                  onChange={() => toggleCancel(sub.merchant)}
                  className="w-4 h-4 rounded accent-ws-charcoal"
                />
              </label>
            </div>
          );
        })}
      </div>

      {/* Reinvestment summary */}
      <div className="mt-6">
        {canceledCount === 0 ? (
          <p className="text-sm text-ws-grey text-center">
            Select subscriptions to cancel and redirect into investments
          </p>
        ) : (
          <div>
            <p className="text-sm text-ws-charcoal">
              You&apos;re freeing up{" "}
              <span className="font-bold text-ws-green">
                {formatCurrency(freedMonthly)}/month
              </span>{" "}
              by canceling {canceledCount} subscription
              {canceledCount !== 1 && "s"}
            </p>

            {/* Fund picker */}
            <p className="text-xs text-ws-grey mt-4 font-bold uppercase tracking-wide">
              Reinvest into:
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {FUND_OPTIONS.map((fund) => (
                <button
                  key={fund}
                  onClick={() => setSelectedFund(fund)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-[72px] transition-colors ${
                    selectedFund === fund
                      ? "bg-ws-charcoal text-white"
                      : "bg-ws-light-grey text-ws-charcoal"
                  }`}
                >
                  {fund}
                </button>
              ))}
            </div>

            {/* 5-year projection */}
            <p className="text-xs text-ws-grey mt-3">
              At 7% average annual return,{" "}
              <span className="font-bold text-ws-charcoal">
                {formatCurrency(freedMonthly)}/month
              </span>{" "}
              could grow to{" "}
              <span className="font-bold text-ws-green">
                ~{formatCurrency(fiveYearValue)}
              </span>{" "}
              in 5 years
            </p>
          </div>
        )}
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

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="flex-1 text-sm font-bold text-ws-charcoal bg-ws-light-grey rounded-[72px] py-3 hover:opacity-80 transition-opacity"
        >
          Back
        </button>
        <button
          onClick={onContinue}
          disabled={canceledCount === 0}
          className="flex-1 text-sm font-bold text-white bg-ws-charcoal rounded-[72px] py-3 transition-opacity disabled:opacity-40 hover:opacity-90"
        >
          Commit to Cancellations
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

