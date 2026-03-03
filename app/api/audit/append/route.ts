import { NextResponse } from "next/server";
import { appendDecisionAuditEvent } from "@/lib/domain/audit-log";
import type { DecisionIntent } from "@/lib/domain/decision-intent";
import type { PolicyDecision, SpendingForecast } from "@/lib/types";

export const runtime = "nodejs";

interface AuditAppendBody {
  snapshotDateISO: string;
  nextPayDateISO: string;
  intent: DecisionIntent;
  seed: number;
  forecast: SpendingForecast;
  policy: PolicyDecision;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AuditAppendBody>;

    if (
      typeof body.snapshotDateISO !== "string" ||
      typeof body.nextPayDateISO !== "string" ||
      typeof body.seed !== "number" ||
      !body.intent ||
      !body.forecast ||
      !body.policy
    ) {
      return NextResponse.json({ error: "Invalid audit payload" }, { status: 400 });
    }

    await appendDecisionAuditEvent({
      snapshotDateISO: body.snapshotDateISO,
      nextPayDateISO: body.nextPayDateISO,
      intent: body.intent,
      seed: body.seed,
      forecast: body.forecast,
      policy: body.policy,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to append audit event" }, { status: 500 });
  }
}
