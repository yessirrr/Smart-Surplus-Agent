"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import transactions from "@/data/transactions.json";
import userProfile from "@/data/user-profile.json";
import type { Transaction, UserProfile, HabitIntensity } from "@/lib/types";
import { analyzeTransactions } from "@/lib/domain";
import { useRequest } from "@/lib/narrative/use-request";
import type { HabitInsightResult } from "@/lib/narrative/skills/habit-insight";
import type { GoalInsightResult } from "@/lib/narrative/skills/goal-insight";
import { buildRecurringHabit } from "@/lib/utils/build-recurring-habit";
import { ProfileStep } from "@/components/habits/ProfileStep";
import { HabitSelectionStep } from "@/components/habits/HabitSelectionStep";
import { TransactionReviewStep } from "@/components/habits/TransactionReviewStep";
import { GoalStep } from "@/components/habits/GoalStep";
import { SubscriptionGoalStep } from "@/components/habits/SubscriptionGoalStep";
import { SummaryStep } from "@/components/habits/SummaryStep";

const STEP_COUNT = 5;

function computeFiveYear(monthlyAmount: number): number {
  if (monthlyAmount <= 0) return 0;
  const r = 0.07 / 12;
  const n = 60;
  return monthlyAmount * ((Math.pow(1 + r, n) - 1) / r);
}

export default function HabitsPage() {
  const profile = userProfile as UserProfile;
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

  // Build synthetic recurring habit and append to candidates
  const allHabitCandidates = useMemo(() => {
    const recurring = buildRecurringHabit(analysis.recurringPatterns, txns);
    return recurring
      ? [...analysis.habitCandidates, recurring]
      : analysis.habitCandidates;
  }, [analysis, txns]);

  // Step navigation
  const [currentStep, setCurrentStep] = useState(0);
  const directionRef = useRef<"forward" | "backward">("forward");

  // Step 0: Profile state
  const [name, setName] = useState(profile.name);
  const [age, setAge] = useState(profile.age);
  const [location, setLocation] = useState(
    `${profile.city}, ${profile.province}`
  );
  const [riskTolerance, setRiskTolerance] = useState<"low" | "medium" | "high">(
    profile.risk_tolerance
  );
  const [investmentHorizon, setInvestmentHorizon] = useState(
    profile.investment_horizon
  );
  const [grossIncome, setGrossIncome] = useState(profile.income.gross_annual);

  // Step 1: Habit selection
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);

  // Step 2: Transaction confirmation (initialized when habit is selected)
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());

  // Step 3: Goal intensity
  const [intensity, setIntensity] = useState<HabitIntensity>("standard");

  // Step 3 (subscription variant): cancel & reinvest state
  const [canceledMerchants, setCanceledMerchants] = useState<Set<string>>(new Set());
  const [selectedFund, setSelectedFund] = useState<string>("S&P 500 Index");

  // Lift habit insight hook to parent — persists across step navigation
  const {
    data: insight,
    loading: insightLoading,
    error: insightError,
    generate: fetchInsight,
  } = useRequest<HabitInsightResult>("/api/narrative/habit-insight");

  useEffect(() => {
    if (!selectedHabitId) return;

    const selected = allHabitCandidates.find((h) => h.id === selectedHabitId);
    if (!selected) return;

    if (selected.category === "subscriptions") {
      const selectedTxnIds = new Set(selected.transactionIds);
      const confirmedSpend = txns
        .filter((t) => selectedTxnIds.has(t.id) && confirmedIds.has(t.id))
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const confirmedCount = selected.transactionIds.filter((id) =>
        confirmedIds.has(id)
      ).length;

      fetchInsight({
        habitId: selectedHabitId,
        confirmedSpend,
        confirmedCount,
        goalMode: "cancel_reinvest",
      });
      return;
    }

    fetchInsight({ habitId: selectedHabitId });
  }, [selectedHabitId, allHabitCandidates, txns, confirmedIds, fetchInsight]);

  // Goal insight hook (subscription flow only)
  const {
    data: goalInsight,
    loading: goalInsightLoading,
    error: goalInsightError,
    generate: fetchGoalInsight,
  } = useRequest<GoalInsightResult>("/api/narrative/goal-insight");

  const selectedHabit = allHabitCandidates.find(
    (h) => h.id === selectedHabitId
  );

  const isSubscription = selectedHabit?.category === "subscriptions";

  useEffect(() => {
    if (!selectedHabitId || !selectedHabit || !isSubscription) return;

    fetchGoalInsight({
      habitName: selectedHabit.name,
      category: "subscriptions",
      currentWeeklyFrequency: 0,
      avgCostPerOccurrence: 0,
      selectedIntensity: "cancel",
      reductionPercent: 100,
      newWeeklyFrequency: 0,
      monthlySavings: selectedHabit.metrics.monthlySpend,
      yearlySavings: selectedHabit.metrics.yearlyProjection,
      fiveYearInvestmentValue: computeFiveYear(selectedHabit.metrics.monthlySpend),
    });
  }, [selectedHabitId, selectedHabit, isSubscription, fetchGoalInsight]);

  // Compute canceled amount for subscription summary
  const canceledAmount = useMemo(() => {
    if (!selectedHabit || !isSubscription) return 0;
    const txnIds = new Set(selectedHabit.transactionIds);
    const matchingTxns = txns.filter((t) => txnIds.has(t.id));
    const merchantTotals = new Map<string, number>();
    for (const txn of matchingTxns) {
      merchantTotals.set(
        txn.merchant,
        (merchantTotals.get(txn.merchant) ?? 0) + Math.abs(txn.amount)
      );
    }
    const monthsActive = Math.max(selectedHabit.metrics.monthsActive, 1);
    let total = 0;
    for (const merchant of canceledMerchants) {
      total += (merchantTotals.get(merchant) ?? 0) / monthsActive;
    }
    return total;
  }, [selectedHabit, isSubscription, canceledMerchants, txns]);

  function handleSelectHabit(id: string) {
    setSelectedHabitId(id);
    const habit = allHabitCandidates.find((h) => h.id === id);
    if (habit) {
      setConfirmedIds(new Set(habit.transactionIds));
    }
    // Reset subscription state when selecting a new habit
    setCanceledMerchants(new Set());
    setSelectedFund("S&P 500 Index");
  }

  function goNext() {
    directionRef.current = "forward";
    setCurrentStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  }

  function goBack() {
    directionRef.current = "backward";
    setCurrentStep((s) => Math.max(s - 1, 0));
  }

  const animClass =
    directionRef.current === "forward" ? "step-forward" : "step-backward";

  return (
    <div className="min-h-screen bg-ws-off-white">
      <div className="mx-auto max-w-[654px] px-4 py-6">
        {/* Back to Dashboard */}
        <Link
          href="/"
          className="text-sm text-ws-grey hover:text-ws-charcoal transition-colors"
        >
          &larr; Back to Dashboard
        </Link>

        {/* Progress indicator */}
        <div className="flex gap-1.5 mb-8 mt-4">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= currentStep ? "bg-ws-charcoal" : "bg-ws-light-grey"
              }`}
            />
          ))}
        </div>

        <div key={currentStep} className={animClass}>
          {currentStep === 0 && (
            <ProfileStep
              profile={profile}
              name={name}
              setName={setName}
              age={age}
              setAge={setAge}
              location={location}
              setLocation={setLocation}
              riskTolerance={riskTolerance}
              setRiskTolerance={setRiskTolerance}
              investmentHorizon={investmentHorizon}
              setInvestmentHorizon={setInvestmentHorizon}
              grossIncome={grossIncome}
              setGrossIncome={setGrossIncome}
              onContinue={goNext}
            />
          )}

          {currentStep === 1 && (
            <HabitSelectionStep
              habits={allHabitCandidates}
              selectedHabitId={selectedHabitId}
              setSelectedHabitId={handleSelectHabit}
              onBack={goBack}
              onContinue={goNext}
            />
          )}

          {currentStep === 2 && selectedHabit && (
            <TransactionReviewStep
              habit={selectedHabit}
              allTransactions={txns}
              confirmedIds={confirmedIds}
              setConfirmedIds={setConfirmedIds}
              insight={insight}
              insightLoading={insightLoading}
              insightError={insightError}
              onBack={goBack}
              onContinue={goNext}
            />
          )}

          {currentStep === 3 && selectedHabit && (
            isSubscription ? (
              <SubscriptionGoalStep
                habit={selectedHabit}
                allTransactions={txns}
                canceledMerchants={canceledMerchants}
                setCanceledMerchants={setCanceledMerchants}
                selectedFund={selectedFund}
                setSelectedFund={setSelectedFund}
                goalInsight={goalInsight}
                goalInsightLoading={goalInsightLoading}
                goalInsightError={goalInsightError}
                onBack={goBack}
                onContinue={goNext}
              />
            ) : (
              <GoalStep
                habit={selectedHabit}
                intensity={intensity}
                setIntensity={setIntensity}
                onBack={goBack}
                onContinue={goNext}
              />
            )
          )}

          {currentStep === 4 && selectedHabit && (
            <SummaryStep
              habit={selectedHabit}
              intensity={intensity}
              confirmedCount={confirmedIds.size}
              isSubscription={isSubscription}
              canceledMerchants={canceledMerchants}
              canceledAmount={canceledAmount}
              selectedFund={selectedFund}
            />
          )}
        </div>
      </div>
    </div>
  );
}


