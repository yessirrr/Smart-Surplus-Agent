"use client";

import { useState, useMemo, useRef } from "react";
import transactions from "@/data/transactions.json";
import userProfile from "@/data/user-profile.json";
import type { Transaction, UserProfile, HabitIntensity } from "@/lib/types";
import { analyzeTransactions } from "@/lib/domain";
import { ProfileStep } from "@/components/habits/ProfileStep";
import { HabitSelectionStep } from "@/components/habits/HabitSelectionStep";
import { TransactionReviewStep } from "@/components/habits/TransactionReviewStep";
import { GoalStep } from "@/components/habits/GoalStep";
import { SummaryStep } from "@/components/habits/SummaryStep";

const STEP_COUNT = 5;

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

  const selectedHabit = analysis.habitCandidates.find(
    (h) => h.id === selectedHabitId
  );

  function handleSelectHabit(id: string) {
    setSelectedHabitId(id);
    const habit = analysis.habitCandidates.find((h) => h.id === id);
    if (habit) {
      setConfirmedIds(new Set(habit.transactionIds));
    }
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
        {/* Progress indicator */}
        <div className="flex gap-1.5 mb-8">
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
              habits={analysis.habitCandidates}
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
              onBack={goBack}
              onContinue={goNext}
            />
          )}

          {currentStep === 3 && selectedHabit && (
            <GoalStep
              habit={selectedHabit}
              intensity={intensity}
              setIntensity={setIntensity}
              onBack={goBack}
              onContinue={goNext}
            />
          )}

          {currentStep === 4 && selectedHabit && (
            <SummaryStep
              habit={selectedHabit}
              intensity={intensity}
              confirmedCount={confirmedIds.size}
            />
          )}
        </div>
      </div>
    </div>
  );
}
