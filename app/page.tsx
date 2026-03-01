import transactions from "@/data/transactions.json";
import userProfile from "@/data/user-profile.json";
import type { Transaction, UserProfile } from "@/lib/types";
import { analyzeTransactions } from "@/lib/domain";
import { Header } from "@/components/Header";
import { BalanceCard } from "@/components/BalanceCard";
import { SpendInvestBreakdown } from "@/components/SpendInvestBreakdown";
import { AgentInsightCard } from "@/components/AgentInsightCard";
import { SectionHeader } from "@/components/SectionHeader";
import { TransactionList } from "@/components/TransactionList";

export default function DashboardPage() {
  const profile = userProfile as UserProfile;
  const txns = transactions as Transaction[];

  const analysis = analyzeTransactions(txns, {
    frequency: "biweekly",
    dayOfWeek: "friday",
    amount: 2076,
  });

  // Total balance across all accounts
  const totalBalance =
    profile.accounts.chequing_balance +
    profile.accounts.savings_balance +
    profile.accounts.tfsa_balance +
    profile.accounts.rrsp_balance;

  // Latest month in the dataset for spending calculation
  const latestDate = txns[txns.length - 1]?.date ?? "";
  const latestMonth = latestDate.slice(0, 7); // "2025-12"

  const currentMonth = txns.filter((t) => t.date.startsWith(latestMonth));
  const monthlySpending = currentMonth
    .filter((t) => t.type === "debit")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Investing = TFSA + RRSP balances as a proxy
  const monthlyInvesting = profile.accounts.tfsa_balance;

  // Extract first name from full name
  const firstName = profile.name.split(" ")[0];

  // Recent transactions: last 20, sorted newest first
  const recentTransactions = [...txns]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);

  return (
    <div className="pb-12">
      <Header userName={firstName} />
      <BalanceCard balance={totalBalance} />
      <div className="flex flex-col gap-4">
        <SpendInvestBreakdown
          spending={monthlySpending}
          investing={monthlyInvesting}
        />
        <AgentInsightCard
          habitCount={analysis.habitCandidates.length}
          monthlySavings={
            analysis.surplusSummary.averageMonthlyPotentialSurplus -
            analysis.surplusSummary.averageMonthlySurplus
          }
        />
      </div>
      <SectionHeader title="Recent Transactions" />
      <TransactionList transactions={recentTransactions} />
    </div>
  );
}