import transactions from "@/data/transactions.json";
import userProfile from "@/data/user-profile.json";
import type { Transaction, UserProfile } from "@/lib/types";
import { analyzeTransactions } from "@/lib/domain";
import { Header } from "@/components/Header";
import { BalanceCard } from "@/components/BalanceCard";
import { SpendInvestBreakdown } from "@/components/SpendInvestBreakdown";
import { AgentCard } from "@/components/AgentCard";
import { SectionHeader } from "@/components/SectionHeader";
import { TransactionList } from "@/components/TransactionList";

export default function DashboardPage() {
  const profile = userProfile as UserProfile;
  const txns = transactions as Transaction[];

  // TEMPORARY — remove after verification
  const analysis = analyzeTransactions(
    txns,
    { frequency: "biweekly", dayOfWeek: "friday", amount: 2076 }
  );

  console.log("=== ODYSSEUS ENGINE VERIFICATION ===");
  console.log(`Recurring patterns found: ${analysis.recurringPatterns.length}`);
  console.log(`Habit candidates found: ${analysis.habitCandidates.length}`);
  analysis.habitCandidates.forEach(h => {
    console.log(`  → ${h.name}: ${h.metrics.monthlySpend.toFixed(2)}/mo, confidence: ${h.confidence.toFixed(2)}, yearly savings: ${h.suggestedGoal.potentialYearlySavings.toFixed(2)}`);
  });
  console.log(`Avg monthly surplus: ${analysis.surplusSummary.averageMonthlySurplus.toFixed(2)}`);
  console.log(`Avg monthly POTENTIAL surplus: ${analysis.surplusSummary.averageMonthlyPotentialSurplus.toFixed(2)}`);
  console.log(`Total habit spend (all time): ${analysis.surplusSummary.totalHabitSpend.toFixed(2)}`);
  console.log("====================================");

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
        <AgentCard />
      </div>
      <SectionHeader title="Recent Transactions" />
      <TransactionList transactions={recentTransactions} />
    </div>
  );
}
