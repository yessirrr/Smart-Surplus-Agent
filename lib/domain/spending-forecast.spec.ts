import assert from "node:assert/strict";
import test from "node:test";
import transactions from "@/data/transactions.json";
import userProfile from "@/data/user-profile.json";
import { analyzeTransactions } from "@/lib/domain";
import { buildCashflowSnapshot } from "@/lib/domain/cashflow-model";
import { forecastVariableSpendUntilNextPay } from "@/lib/domain/spending-forecast";
import type { PaySchedule, Transaction, UserProfile } from "@/lib/types";

const paySchedule: PaySchedule = {
  frequency: "biweekly",
  dayOfWeek: "friday",
  amount: 2076,
};

const txns = transactions as Transaction[];
const profile = userProfile as UserProfile;

function buildSnapshot() {
  const analysis = analyzeTransactions(txns, paySchedule);
  return buildCashflowSnapshot(analysis.surplusSummary, profile, txns, paySchedule);
}

test("forecastVariableSpendUntilNextPay is deterministic for fixed seed and inputs", () => {
  const snapshot = buildSnapshot();

  const first = forecastVariableSpendUntilNextPay({
    transactions: txns,
    snapshot,
    paySchedule,
    seed: 12345,
    trials: 600,
  });

  const second = forecastVariableSpendUntilNextPay({
    transactions: txns,
    snapshot,
    paySchedule,
    seed: 12345,
    trials: 600,
  });

  assert.deepEqual(first, second);
});

test("forecastVariableSpendUntilNextPay produces sensible quantiles", () => {
  const snapshot = buildSnapshot();

  const forecast = forecastVariableSpendUntilNextPay({
    transactions: txns,
    snapshot,
    paySchedule,
    seed: 8,
    trials: 700,
  });

  assert.ok(forecast.p50WindowSpend <= forecast.expectedWindowSpend);
  assert.ok(forecast.expectedWindowSpend <= forecast.p90WindowSpend);
});

test("forecastVariableSpendUntilNextPay changes when seed changes", () => {
  const snapshot = buildSnapshot();

  const a = forecastVariableSpendUntilNextPay({
    transactions: txns,
    snapshot,
    paySchedule,
    seed: 101,
    trials: 700,
  });

  const b = forecastVariableSpendUntilNextPay({
    transactions: txns,
    snapshot,
    paySchedule,
    seed: 202,
    trials: 700,
  });

  assert.ok(
    a.p50WindowSpend !== b.p50WindowSpend || a.p90WindowSpend !== b.p90WindowSpend
  );
});

test("forecastVariableSpendUntilNextPay safely returns zeroes when window cannot be evaluated", () => {
  const snapshot = buildSnapshot();

  const unsupportedSchedule: PaySchedule = {
    frequency: "monthly",
    amount: 2076,
  };

  const forecast = forecastVariableSpendUntilNextPay({
    transactions: txns,
    snapshot,
    paySchedule: unsupportedSchedule,
    seed: 11,
  });

  assert.equal(forecast.windowDays, 0);
  assert.equal(forecast.expectedWindowSpend, 0);
  assert.equal(forecast.p50WindowSpend, 0);
  assert.equal(forecast.p90WindowSpend, 0);
});
