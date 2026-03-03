import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { DecisionIntent } from "./decision-intent";
import type { PolicyDecision, SpendingForecast } from "@/lib/types";

const AUDIT_PATH = path.join(process.cwd(), "data", "audit-events.json");

export interface DecisionAuditEvent {
  eventType: "decision_check";
  timestampISO: string;
  snapshotDateISO: string;
  nextPayDateISO: string;
  intent: {
    intentType: DecisionIntent["intentType"];
    cadence: DecisionIntent["cadence"];
    amount: number;
    horizon: DecisionIntent["horizon"];
  };
  seed: number;
  forecast: {
    windowDays: number;
    expectedWindowSpend: number;
    p50WindowSpend: number;
    p90WindowSpend: number;
    trials: number;
  };
  policy: {
    action: PolicyDecision["action"];
    reasonCodes: string[];
    safetyPercentileUsed: PolicyDecision["safetyPercentileUsed"];
    requiresApproval: boolean;
  };
}

export async function appendDecisionAuditEvent(args: {
  snapshotDateISO: string;
  nextPayDateISO: string;
  intent: DecisionIntent;
  seed: number;
  forecast: SpendingForecast;
  policy: PolicyDecision;
}): Promise<DecisionAuditEvent> {
  const event: DecisionAuditEvent = {
    eventType: "decision_check",
    timestampISO: new Date().toISOString(),
    snapshotDateISO: args.snapshotDateISO,
    nextPayDateISO: args.nextPayDateISO,
    intent: {
      intentType: args.intent.intentType,
      cadence: args.intent.cadence,
      amount: args.intent.amount,
      horizon: args.intent.horizon,
    },
    seed: args.seed,
    forecast: {
      windowDays: args.forecast.windowDays,
      expectedWindowSpend: args.forecast.expectedWindowSpend,
      p50WindowSpend: args.forecast.p50WindowSpend,
      p90WindowSpend: args.forecast.p90WindowSpend,
      trials: args.forecast.trials,
    },
    policy: {
      action: args.policy.action,
      reasonCodes: [...args.policy.reasonCodes],
      safetyPercentileUsed: args.policy.safetyPercentileUsed,
      requiresApproval: args.policy.requiresApproval,
    },
  };

  const events = await readAuditEvents();
  events.push(event);

  await mkdir(path.dirname(AUDIT_PATH), { recursive: true });
  await writeFile(AUDIT_PATH, JSON.stringify(events, null, 2) + "\n", "utf8");

  return event;
}

async function readAuditEvents(): Promise<DecisionAuditEvent[]> {
  try {
    const raw = await readFile(AUDIT_PATH, "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as DecisionAuditEvent[];
  } catch {
    return [];
  }
}

