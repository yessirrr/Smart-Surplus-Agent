import transactions from "@/data/transactions.json";
import userProfile from "@/data/user-profile.json";
import type { Transaction, UserProfile } from "@/lib/types";
import { Header } from "@/components/Header";
import { BalanceCard } from "@/components/BalanceCard";
import { SpendInvestBreakdown } from "@/components/SpendInvestBreakdown";
import { AgentCard } from "@/components/AgentCard";
import { SectionHeader } from "@/components/SectionHeader";
import { TransactionList } from "@/components/TransactionList";

export default function DashboardPage() {
  const profile = userProfile as UserProfile;
  const txns = transactions as Transaction[];

  const totalBalance =
    profile.currentHoldings.tfsa +
    profile.currentHoldings.crypto +
    profile.currentHoldings.cashBalance;

  // Current month spending (February 2026)
  const currentMonth = txns.filter((t) => t.date.startsWith("2026-02"));
  const monthlySpending = currentMonth
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const monthlyInvesting = profile.currentHoldings.tfsa;

  // Recent transactions: last 15, sorted newest first
  const recentTransactions = [...txns]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 15);

  return (
    <div className="pb-12">
      <Header userName={profile.firstName} />
      <BalanceCard balance={totalBalance} />
      <div className="flex flex-col gap-4">
        <SpendInvestBreakdown
          spending={monthlySpending}
          investing={monthlyInvesting}
        />
        <AgentCard />
      </div>
      <SectionHeader title="Recent Transactions" />
      <TransactionList transactions={recentTransactions} />
    </div>
  );
}
