"use client";

import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import type { Transaction, HabitCandidate } from "@/lib/types";
import type { HabitInsightResult } from "@/lib/agent/skills/habit-insight";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StockLogoWithPopover } from "@/components/market/StockLogoWithPopover";

interface TransactionReviewStepProps {
  habit: HabitCandidate;
  allTransactions: Transaction[];
  confirmedIds: Set<string>;
  setConfirmedIds: (ids: Set<string>) => void;
  insight: HabitInsightResult | null;
  insightLoading: boolean;
  insightError: string | null;
  onBack: () => void;
  onContinue: () => void;
}

export function TransactionReviewStep({
  habit,
  allTransactions,
  confirmedIds,
  setConfirmedIds,
  insight,
  insightLoading,
  insightError,
  onBack,
  onContinue,
}: TransactionReviewStepProps) {
  const [showAll, setShowAll] = useState(false);

  // Get habit transactions sorted newest-first
  const habitTxnIds = new Set(habit.transactionIds);
  const habitTransactions = allTransactions
    .filter((t) => habitTxnIds.has(t.id))
    .sort((a, b) => b.date.localeCompare(a.date));

  const displayLimit = 50;
  const visibleTransactions = showAll
    ? habitTransactions
    : habitTransactions.slice(0, displayLimit);

  // Group visible transactions by merchant
  const merchantGroups = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const txn of visibleTransactions) {
      const list = groups.get(txn.merchant) ?? [];
      list.push(txn);
      groups.set(txn.merchant, list);
    }
    // Sort groups by total spend descending
    return [...groups.entries()].sort((a, b) => {
      const spendA = a[1].reduce((s, t) => s + Math.abs(t.amount), 0);
      const spendB = b[1].reduce((s, t) => s + Math.abs(t.amount), 0);
      return spendB - spendA;
    });
  }, [visibleTransactions]);

  // All merchants expanded by default
  const [expandedMerchants, setExpandedMerchants] = useState<Set<string>>(
    () => new Set(merchantGroups.map(([name]) => name))
  );

  const confirmedCount = habitTransactions.filter((t) =>
    confirmedIds.has(t.id)
  ).length;
  const confirmedSpend = habitTransactions
    .filter((t) => confirmedIds.has(t.id))
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalSpend = habitTransactions.reduce(
    (sum, t) => sum + Math.abs(t.amount),
    0
  );

  function toggleTransaction(id: string) {
    const next = new Set(confirmedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setConfirmedIds(next);
  }

  function toggleMerchant(merchant: string) {
    setExpandedMerchants((prev) => {
      const next = new Set(prev);
      if (next.has(merchant)) {
        next.delete(merchant);
      } else {
        next.add(merchant);
      }
      return next;
    });
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-ws-charcoal">
        Review Transactions
      </h1>
      <p className="text-sm text-ws-grey mt-2">
        These transactions were flagged as part of your{" "}
        <span className="font-bold text-ws-charcoal">{habit.name}</span> habit.
        Uncheck any that don&apos;t belong.
      </p>

      {/* Summary bar */}
      <div className="mt-4 flex gap-4 text-xs text-ws-grey">
        <span>{habitTransactions.length} transactions</span>
        <span>&middot;</span>
        <span>{formatCurrency(totalSpend)} total</span>
        <span>&middot;</span>
        <span>{habit.metrics.monthsActive} months</span>
      </div>

      {/* Merchant-grouped transaction list */}
      <div className="mt-4 bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto divide-y divide-ws-border">
          {merchantGroups.map(([merchant, txns]) => {
            const merchantSpend = txns.reduce(
              (s, t) => s + Math.abs(t.amount),
              0
            );
            const isExpanded = expandedMerchants.has(merchant);

            return (
              <div key={merchant}>
                {/* Merchant header */}
                <button
                  onClick={() => toggleMerchant(merchant)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ws-off-white transition-colors"
                >
                  <StockLogoWithPopover merchant={merchant} size={32} />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-bold text-ws-charcoal truncate">
                      {merchant}
                    </p>
                    <p className="text-[10px] text-ws-grey">
                      {txns.length} transaction{txns.length !== 1 && "s"}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-ws-red tabular-nums whitespace-nowrap mr-2">
                    -{formatCurrency(merchantSpend)}
                  </p>
                  <ChevronDown
                    size={16}
                    className={`text-ws-grey shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Transactions within merchant */}
                {isExpanded &&
                  txns.map((txn) => (
                    <label
                      key={txn.id}
                      className="flex items-center gap-3 px-4 py-2.5 pl-8 cursor-pointer hover:bg-ws-off-white transition-colors border-t border-ws-border/50"
                    >
                      <input
                        type="checkbox"
                        checked={confirmedIds.has(txn.id)}
                        onChange={() => toggleTransaction(txn.id)}
                        className="w-4 h-4 rounded accent-ws-charcoal shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-ws-grey">
                          {formatDate(txn.date)}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-ws-red tabular-nums whitespace-nowrap">
                        -{formatCurrency(txn.amount)}
                      </p>
                    </label>
                  ))}
              </div>
            );
          })}
        </div>

        {!showAll && habitTransactions.length > displayLimit && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full text-xs font-bold text-ws-charcoal py-3 border-t border-ws-border hover:bg-ws-light-grey transition-colors"
          >
            Show all {habitTransactions.length} transactions
          </button>
        )}
      </div>

      {/* Confirmed summary */}
      <p className="mt-4 text-xs text-ws-grey text-center">
        {confirmedCount} of {habitTransactions.length} transactions confirmed
        &middot; {formatCurrency(confirmedSpend)} confirmed spend
      </p>

      {/* Odysseus Insight */}
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
