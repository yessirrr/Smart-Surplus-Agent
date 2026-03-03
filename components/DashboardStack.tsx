"use client";

import { useEffect, useState } from "react";
import { getOdysseusOptIn, getOdysseusTermsAccepted } from "@/lib/client/odysseusOptIn";
import type { CashflowSnapshot } from "@/lib/domain/cashflow-model";
import type { PaySchedule, Transaction } from "@/lib/types";
import { SpendInvestBreakdown } from "@/components/SpendInvestBreakdown";
import { InsightCard } from "@/components/InsightCard";
import { DecisionMode } from "@/components/DecisionMode";

interface DashboardStackProps {
  spending: number;
  investing: number;
  habitCount: number;
  monthlySavings: number;
  snapshot: CashflowSnapshot;
  transactions: Transaction[];
  paySchedule: PaySchedule;
}

export function DashboardStack({
  spending,
  investing,
  habitCount,
  monthlySavings,
  snapshot,
  transactions,
  paySchedule,
}: DashboardStackProps) {
  const [isOdysseusReady, setIsOdysseusReady] = useState(false);
  const [isOdysseusEnabled, setIsOdysseusEnabled] = useState(false);
  const [isOdysseusTermsAccepted, setIsOdysseusTermsAccepted] = useState(false);

  useEffect(() => {
    setIsOdysseusEnabled(getOdysseusOptIn());
    setIsOdysseusTermsAccepted(getOdysseusTermsAccepted());
    setIsOdysseusReady(true);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <SpendInvestBreakdown
        spending={spending}
        investing={investing}
        isOdysseusReady={isOdysseusReady}
        isOdysseusEnabled={isOdysseusEnabled}
        isOdysseusTermsAccepted={isOdysseusTermsAccepted}
        onOdysseusEnabledChange={setIsOdysseusEnabled}
        onOdysseusTermsAcceptedChange={setIsOdysseusTermsAccepted}
      />
      {isOdysseusReady && isOdysseusEnabled ? (
        <InsightCard
          habitCount={habitCount}
          monthlySavings={monthlySavings}
        />
      ) : null}
      {isOdysseusReady && isOdysseusEnabled ? (
        <DecisionMode
          snapshot={snapshot}
          transactions={transactions}
          paySchedule={paySchedule}
        />
      ) : null}
    </div>
  );
}



