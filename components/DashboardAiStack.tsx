"use client";

import { useEffect, useState } from "react";
import { getAiOptIn, getAiTermsAccepted } from "@/lib/client/aiOptIn";
import type { CashflowSnapshot } from "@/lib/domain/cashflow-model";
import type { PaySchedule, Transaction } from "@/lib/types";
import { SpendInvestBreakdown } from "@/components/SpendInvestBreakdown";
import { AgentInsightCard } from "@/components/AgentInsightCard";
import { DecisionMode } from "@/components/DecisionMode";

interface DashboardAiStackProps {
  spending: number;
  investing: number;
  habitCount: number;
  monthlySavings: number;
  snapshot: CashflowSnapshot;
  transactions: Transaction[];
  paySchedule: PaySchedule;
}

export function DashboardAiStack({
  spending,
  investing,
  habitCount,
  monthlySavings,
  snapshot,
  transactions,
  paySchedule,
}: DashboardAiStackProps) {
  const [isAiOptInReady, setIsAiOptInReady] = useState(false);
  const [isAiOptedIn, setIsAiOptedIn] = useState(false);
  const [isAiTermsAccepted, setIsAiTermsAccepted] = useState(false);

  useEffect(() => {
    setIsAiOptedIn(getAiOptIn());
    setIsAiTermsAccepted(getAiTermsAccepted());
    setIsAiOptInReady(true);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <SpendInvestBreakdown
        spending={spending}
        investing={investing}
        isAiOptInReady={isAiOptInReady}
        isAiOptedIn={isAiOptedIn}
        isAiTermsAccepted={isAiTermsAccepted}
        onAiOptInChange={setIsAiOptedIn}
        onAiTermsAcceptedChange={setIsAiTermsAccepted}
      />
      {isAiOptInReady && isAiOptedIn ? (
        <AgentInsightCard
          habitCount={habitCount}
          monthlySavings={monthlySavings}
        />
      ) : null}
      <DecisionMode
        snapshot={snapshot}
        transactions={transactions}
        paySchedule={paySchedule}
      />
    </div>
  );
}
