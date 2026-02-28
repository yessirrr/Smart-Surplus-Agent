"use client";

import { useState } from "react";
import type { Transaction, HabitCandidate } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

interface TransactionReviewStepProps {
  habit: HabitCandidate;
  allTransactions: Transaction[];
  confirmedIds: Set<string>;
  setConfirmedIds: (ids: Set<string>) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function TransactionReviewStep({
  habit,
  allTransactions,
  confirmedIds,
  setConfirmedIds,
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

      {/* Transaction list */}
      <div className="mt-4 bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto divide-y divide-ws-border">
          {visibleTransactions.map((txn) => (
            <label
              key={txn.id}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-ws-off-white transition-colors"
            >
              <input
                type="checkbox"
                checked={confirmedIds.has(txn.id)}
                onChange={() => toggleTransaction(txn.id)}
                className="w-4 h-4 rounded accent-ws-charcoal shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ws-charcoal truncate">
                  {txn.merchant}
                </p>
                <p className="text-xs text-ws-grey">{formatDate(txn.date)}</p>
              </div>
              <p className="text-sm font-bold text-ws-red tabular-nums whitespace-nowrap">
                -{formatCurrency(txn.amount)}
              </p>
            </label>
          ))}
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
