import assert from "node:assert/strict";
import test from "node:test";
import transactions from "@/data/transactions.json";
import userProfile from "@/data/user-profile.json";
import { analyzeTransactions } from "@/lib/domain";
import {
  buildCashflowSnapshot,
  computeDaysUntilNextPay,
} from "@/lib/domain/cashflow-model";
import type { PaySchedule, Transaction, UserProfile } from "@/lib/types";

const paySchedule: PaySchedule = {
  frequency: "biweekly",
  dayOfWeek: "friday",
  amount: 2076,
};

const txns = transactions as Transaction[];
const profile = userProfile as UserProfile;

function legacyDaysUntilNextPay(fromDateISO: string): number {
  const from = new Date(fromDateISO + "T00:00:00");
  const anchor = new Date("2024-01-05T00:00:00");

  const diffMs = from.getTime() - anchor.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const cyclesPassed = Math.floor(diffDays / 14);
  const nextPayMs = anchor.getTime() + (cyclesPassed + 1) * 14 * 24 * 60 * 60 * 1000;
  const nextPay = new Date(nextPayMs);

  const daysUntil = Math.ceil(
    (nextPay.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysUntil <= 0 ? 14 : daysUntil;
}

test("buildCashflowSnapshot sets snapshotDateISO to latest transaction date", () => {
  const analysis = analyzeTransactions(txns, paySchedule);
  const snapshot = buildCashflowSnapshot(
    analysis.surplusSummary,
    profile,
    txns,
    paySchedule
  );

  const latestDate = txns.reduce((latest, transaction) => {
    return transaction.date > latest ? transaction.date : latest;
  }, txns[0]?.date ?? "2025-01-01");

  assert.equal(snapshot.snapshotDateISO, latestDate);
  assert.equal(snapshot.latestTransactionDateISO, latestDate);
});

test("daysUntilNextPay remains unchanged under default biweekly Friday logic", () => {
  const analysis = analyzeTransactions(txns, paySchedule);
  const snapshot = buildCashflowSnapshot(
    analysis.surplusSummary,
    profile,
    txns,
    paySchedule
  );

  const expectedDays = legacyDaysUntilNextPay(snapshot.snapshotDateISO);
  assert.equal(snapshot.daysUntilNextPay, expectedDays);

  const direct = computeDaysUntilNextPay(
    new Date(snapshot.snapshotDateISO + "T00:00:00"),
    paySchedule
  );
  assert.equal(direct.daysUntilNextPay, expectedDays);
  assert.match(direct.nextPayDateISO, /^\d{4}-\d{2}-\d{2}$/);
});
