import transactions from "@/data/transactions.json";
import userProfile from "@/data/user-profile.json";
import type { Transaction, UserProfile } from "@/lib/types";
import { analyzeTransactions } from "@/lib/domain";
import { buildCashflowSnapshot } from "@/lib/domain/cashflow-model";
import { computeStartingBalanceForTargetEnd } from "@/lib/domain/cash-balance";
import { Header } from "@/components/Header";
import { BalanceCard } from "@/components/BalanceCard";
import { DashboardAiStack } from "@/components/DashboardAiStack";
import { SectionHeader } from "@/components/SectionHeader";
import { TransactionList } from "@/components/TransactionList";

const RECENT_TXN_LIMIT = 20;
const TARGET_END_CASH_BALANCE = 14310;

export default function DashboardPage() {
  const profile = userProfile as UserProfile;
  const txns = transactions as Transaction[];

  const paySchedule = {
    frequency: "biweekly" as const,
    dayOfWeek: "friday" as const,
    amount: 2076,
  };

  const analysis = analyzeTransactions(txns, paySchedule);

  const cashBacksolve = computeStartingBalanceForTargetEnd(
    txns,
    TARGET_END_CASH_BALANCE
  );

  if (process.env.NODE_ENV !== "production") {
    console.debug("[cash-backsolve]", {
      targetEndCashBalance: cashBacksolve.targetEndCashBalance,
      netCashflow: cashBacksolve.netCashflow,
      computedStartingBalance: cashBacksolve.computedStartingBalance,
      lastTransactionDate: cashBacksolve.lastTransactionDate,
    });
  }

  // Total balance across all accounts
  const totalBalance =
    profile.accounts.chequing_balance +
    profile.accounts.savings_balance +
    profile.accounts.tfsa_balance +
    profile.accounts.rrsp_balance;

  const cashBalanceForCard = cashBacksolve.endingCashBalance;

  // Investing = TFSA + RRSP balances as a proxy
  const monthlyInvesting = profile.accounts.tfsa_balance;

  // Extract first name from full name
  const firstName = profile.name.split(" ")[0];

  // Cashflow snapshot for Decision Mode
  const snapshot = buildCashflowSnapshot(
    analysis.surplusSummary,
    profile,
    txns,
    paySchedule
  );

  // Recent transactions sorted newest first
  const recentTransactions = [...txns]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT_TXN_LIMIT);

  return (
    <div className="pb-12">
      <Header userName={firstName} />
      <BalanceCard balance={totalBalance} />
      <DashboardAiStack
        spending={cashBalanceForCard}
        investing={monthlyInvesting}
        habitCount={analysis.habitCandidates.length}
        monthlySavings={
          analysis.surplusSummary.averageMonthlyPotentialSurplus -
          analysis.surplusSummary.averageMonthlySurplus
        }
        snapshot={snapshot}
      />
      <SectionHeader title="Recent Transactions" />
      <TransactionList transactions={recentTransactions} />
    </div>
  );
}

