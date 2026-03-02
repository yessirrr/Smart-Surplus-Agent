import {
  assertValidIntent,
  type DecisionIntent,
  type IntentType,
  type SpendCadence,
  type TimeHorizon,
} from "@/lib/domain/decision-intent";
import { openai, isApiKeyValid } from "../openai-client";

export type ClarificationField =
  | "amount"
  | "cadence"
  | "date"
  | "relative_days"
  | "goal_name"
  | "budget_cap";

export interface ParsedDecisionIntentV2 {
  intentType: IntentType;
  amount: number | null;
  cadence: SpendCadence | null;
  horizon: TimeHorizon;
  title: string;
  categoryHint: string | null;
  needsClarification: boolean;
  clarificationQuestion: string | null;
  clarificationFields: ClarificationField[];
}

interface RawParsedIntentV2 {
  intentType: string;
  amount: number | null;
  cadence: string | null;
  horizon: {
    kind: string;
    value?: string | number | null;
  };
  title: string;
  categoryHint: string | null;
  needsClarification: boolean;
  clarificationQuestion: string | null;
  clarificationFields: string[];
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_RE = /\$\s*([\d,]+(?:\.\d{1,2})?)|(\b\d{2,}(?:,\d{3})*(?:\.\d{1,2})?\b)/;

const SYSTEM_PROMPT = `You are an intent parser for a personal finance assistant.

Task:
Convert natural language spending text into structured JSON for deterministic simulation.

Rules:
- Do NOT do financial math.
- Do NOT invent numbers.
- Extract only what is explicitly stated or strongly implied.
- Keep title short (2-5 words).
- If amount is missing, set needsClarification=true and include "amount" in clarificationFields.
- If recurring cadence is ambiguous, set cadence=null and include "cadence".
- If planned purchase timing is unclear, include "date".
- horizon must be one of:
  - { kind: "today" }
  - { kind: "this_week" }
  - { kind: "this_month" }
  - { kind: "date", value: "YYYY-MM-DD" }
  - { kind: "relative_days", value: integer }
- intentType must be exactly one of: impulse, planned_purchase, big_goal, recurring.
- Output ONLY valid JSON matching the schema.`;

const JSON_SCHEMA = {
  name: "decision_intent_v2",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      intentType: {
        type: "string" as const,
        enum: ["impulse", "planned_purchase", "big_goal", "recurring"],
      },
      amount: { type: ["number", "null"] as const },
      cadence: {
        type: ["string", "null"] as const,
        enum: ["one_time", "weekly", "monthly", null],
      },
      horizon: {
        type: "object" as const,
        properties: {
          kind: {
            type: "string" as const,
            enum: ["today", "this_week", "this_month", "date", "relative_days"],
          },
          value: { type: ["string", "number", "null"] as const },
        },
        required: ["kind", "value"],
        additionalProperties: false,
      },
      title: { type: "string" as const },
      categoryHint: { type: ["string", "null"] as const },
      needsClarification: { type: "boolean" as const },
      clarificationQuestion: { type: ["string", "null"] as const },
      clarificationFields: {
        type: "array" as const,
        items: {
          type: "string" as const,
          enum: [
            "amount",
            "cadence",
            "date",
            "relative_days",
            "goal_name",
            "budget_cap",
          ],
        },
      },
    },
    required: [
      "intentType",
      "amount",
      "cadence",
      "horizon",
      "title",
      "categoryHint",
      "needsClarification",
      "clarificationQuestion",
      "clarificationFields",
    ],
    additionalProperties: false,
  },
};

const CLARIFICATION_FIELD_SET: ReadonlySet<ClarificationField> = new Set([
  "amount",
  "cadence",
  "date",
  "relative_days",
  "goal_name",
  "budget_cap",
]);

const CATEGORY_MAP: Array<{ regex: RegExp; value: string }> = [
  { regex: /\b(dinner|lunch|restaurant|food|meal|takeout)\b/i, value: "dining" },
  { regex: /\b(coffee|cafe|latte)\b/i, value: "coffee" },
  { regex: /\b(netflix|spotify|subscription|streaming|membership)\b/i, value: "subscriptions" },
  { regex: /\b(uber|lyft|gas|transit|transport|car|parking)\b/i, value: "transportation" },
  { regex: /\b(vape|alcohol|drinks|bar|beer|wine)\b/i, value: "personal_vices" },
  { regex: /\b(couch|sofa|furniture|shopping|buy|purchase)\b/i, value: "shopping" },
  { regex: /\b(trip|vacation|flight|hotel|travel)\b/i, value: "travel" },
];

function extractAmount(input: string): number | null {
  const match = input.match(CURRENCY_RE);
  if (!match) return null;

  const raw = (match[1] ?? match[2] ?? "").replace(/,/g, "");
  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function detectCategoryHint(input: string): string | null {
  for (const entry of CATEGORY_MAP) {
    if (entry.regex.test(input)) {
      return entry.value;
    }
  }

  return null;
}

function detectIntentType(input: string, amount: number | null): IntentType {
  const lower = input.toLowerCase();

  const recurringCue =
    /\b(weekly|per week|monthly|per month|subscription|recurring|every month|every week)\b/.test(
      lower
    ) || /\$\s*\d+(?:\.\d+)?\s*\/?\s*(week|wk|month|mo)\b/.test(lower);

  const planningCue = /\b(how should i|how do i|go about buying|plan for|save for|afford)\b/.test(
    lower
  );

  const futureCue =
    /\b(next week|next month|tomorrow|in \d+ days|on \d{4}-\d{2}-\d{2})\b/.test(lower) ||
    /\bon\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/.test(lower);

  const bigGoalObjectCue = /\b(car|down payment|home|trip|vacation|tuition|wedding|couch|sofa)\b/.test(
    lower
  );

  if (planningCue || (bigGoalObjectCue && (amount ?? 0) >= 5000 && /\?/.test(lower))) {
    return "big_goal";
  }

  if (recurringCue) {
    return "recurring";
  }

  if (futureCue) {
    return "planned_purchase";
  }

  return "impulse";
}

function detectCadence(input: string, intentType: IntentType): SpendCadence | null {
  const lower = input.toLowerCase();

  if (intentType !== "recurring") {
    return "one_time";
  }

  if (/\b(weekly|per week|every week|\/\s*(wk|week))\b/.test(lower)) {
    return "weekly";
  }

  if (
    /\b(monthly|per month|every month|subscription|recurring|\/\s*(mo|month))\b/.test(
      lower
    )
  ) {
    return "monthly";
  }

  if (/\b(payment|membership|plan|installment|lease)\b/.test(lower)) {
    return null;
  }

  return "monthly";
}

function detectHorizon(input: string): { horizon: TimeHorizon; explicit: boolean } {
  const lower = input.toLowerCase();

  const isoMatch = input.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch && ISO_DATE_RE.test(isoMatch[1])) {
    return { horizon: { kind: "date", value: isoMatch[1] }, explicit: true };
  }

  const inDaysMatch = lower.match(/\bin\s+(\d{1,3})\s+days?\b/);
  if (inDaysMatch) {
    const days = Number.parseInt(inDaysMatch[1], 10);
    if (Number.isInteger(days) && days >= 0) {
      return { horizon: { kind: "relative_days", value: days }, explicit: true };
    }
  }

  if (/\b(today|tonight|now|right now)\b/.test(lower)) {
    return { horizon: { kind: "today" }, explicit: true };
  }

  if (/\b(this week|next week|soon)\b/.test(lower)) {
    return { horizon: { kind: "this_week" }, explicit: true };
  }

  if (/\b(this month|next month)\b/.test(lower)) {
    return { horizon: { kind: "this_month" }, explicit: true };
  }

  return { horizon: { kind: "this_week" }, explicit: false };
}

function buildTitle(
  intentType: IntentType,
  input: string,
  categoryHint: string | null,
  amount: number | null
): string {
  const lower = input.toLowerCase();

  if (intentType === "big_goal") {
    if (/\bcar\b/.test(lower)) return "Buy a car";
    if (/\b(couch|sofa)\b/.test(lower)) return "Buy a couch";
    if (/\b(trip|vacation)\b/.test(lower)) return "Plan a trip";
    return "Big purchase plan";
  }

  if (intentType === "recurring") {
    if (categoryHint === "subscriptions") return "Monthly subscription";
    if (categoryHint === "transportation") return "Recurring transport";
    return "Recurring expense";
  }

  if (intentType === "planned_purchase") {
    if (/\b(couch|sofa)\b/.test(lower)) return "Couch purchase";
    if (/\bcar\b/.test(lower)) return "Car purchase";
    return "Planned purchase";
  }

  if (categoryHint === "dining") {
    return /\b(today|tonight)\b/.test(lower) ? "Dinner tonight" : "Dining spend";
  }

  if (categoryHint === "coffee") {
    return "Coffee run";
  }

  if (amount !== null) {
    return "Quick spend check";
  }

  return "Spending decision";
}

function dedupeFields(fields: ClarificationField[]): ClarificationField[] {
  return [...new Set(fields)];
}

function getClarificationQuestion(fields: ClarificationField[]): string | null {
  if (fields.includes("amount")) {
    return "How much are you considering spending?";
  }

  if (fields.includes("cadence")) {
    return "Is this one-time, weekly, or monthly?";
  }

  if (fields.includes("date") || fields.includes("relative_days")) {
    return "When would you like to make this purchase?";
  }

  if (fields.includes("goal_name")) {
    return "What are you planning to buy?";
  }

  return null;
}

function fallbackParse(input: string): ParsedDecisionIntentV2 {
  const amount = extractAmount(input);
  const categoryHint = detectCategoryHint(input);
  const intentType = detectIntentType(input, amount);
  const cadence = detectCadence(input, intentType);
  const horizonInfo = detectHorizon(input);

  const clarificationFields: ClarificationField[] = [];

  if (amount === null) {
    clarificationFields.push("amount");
  }

  if (intentType === "recurring" && cadence === null) {
    clarificationFields.push("cadence");
  }

  if (intentType === "planned_purchase" && !horizonInfo.explicit) {
    clarificationFields.push("date");
  }

  if (intentType === "big_goal" && !/\b(car|couch|sofa|trip|vacation|home|wedding|tuition)\b/i.test(input)) {
    clarificationFields.push("goal_name");
  }

  const fields = dedupeFields(clarificationFields);

  return {
    intentType,
    amount,
    cadence,
    horizon: horizonInfo.horizon,
    title: buildTitle(intentType, input, categoryHint, amount),
    categoryHint,
    needsClarification: fields.length > 0,
    clarificationQuestion: getClarificationQuestion(fields),
    clarificationFields: fields,
  };
}

function normalizeHorizon(raw: RawParsedIntentV2["horizon"]): TimeHorizon {
  const kind = raw?.kind;

  if (kind === "date") {
    if (typeof raw.value === "string" && ISO_DATE_RE.test(raw.value)) {
      return { kind: "date", value: raw.value };
    }

    return { kind: "this_month" };
  }

  if (kind === "relative_days") {
    if (typeof raw.value === "number" && Number.isInteger(raw.value) && raw.value >= 0) {
      return { kind: "relative_days", value: raw.value };
    }

    return { kind: "this_week" };
  }

  if (kind === "today" || kind === "this_week" || kind === "this_month") {
    return { kind };
  }

  return { kind: "this_week" };
}

function normalizeIntentType(value: string): IntentType {
  if (
    value === "impulse" ||
    value === "planned_purchase" ||
    value === "big_goal" ||
    value === "recurring"
  ) {
    return value;
  }

  return "impulse";
}

function normalizeCadence(value: string | null): SpendCadence | null {
  if (value === "one_time" || value === "weekly" || value === "monthly") {
    return value;
  }

  return null;
}

function normalizeFields(fields: string[]): ClarificationField[] {
  const valid: ClarificationField[] = [];

  for (const field of fields) {
    if (CLARIFICATION_FIELD_SET.has(field as ClarificationField)) {
      valid.push(field as ClarificationField);
    }
  }

  return dedupeFields(valid);
}

function normalizeParsedIntent(raw: RawParsedIntentV2, fallback: ParsedDecisionIntentV2): ParsedDecisionIntentV2 {
  const intentType = normalizeIntentType(raw.intentType);
  const amount =
    typeof raw.amount === "number" && Number.isFinite(raw.amount) && raw.amount > 0
      ? Math.round((raw.amount + Number.EPSILON) * 100) / 100
      : fallback.amount;

  const cadence = normalizeCadence(raw.cadence);
  const normalizedCadence = intentType === "recurring" ? cadence : "one_time";

  const normalized: ParsedDecisionIntentV2 = {
    intentType,
    amount,
    cadence: normalizedCadence,
    horizon: normalizeHorizon(raw.horizon),
    title: raw.title?.trim() ? raw.title.trim() : fallback.title,
    categoryHint:
      typeof raw.categoryHint === "string" && raw.categoryHint.trim().length > 0
        ? raw.categoryHint.trim()
        : fallback.categoryHint,
    needsClarification: Boolean(raw.needsClarification),
    clarificationQuestion:
      typeof raw.clarificationQuestion === "string" && raw.clarificationQuestion.trim().length > 0
        ? raw.clarificationQuestion.trim()
        : null,
    clarificationFields: normalizeFields(Array.isArray(raw.clarificationFields) ? raw.clarificationFields : []),
  };

  if (normalized.amount === null && !normalized.clarificationFields.includes("amount")) {
    normalized.clarificationFields.push("amount");
  }

  if (normalized.intentType === "recurring" && normalized.cadence === null) {
    if (!normalized.clarificationFields.includes("cadence")) {
      normalized.clarificationFields.push("cadence");
    }
  }

  if (
    normalized.intentType === "planned_purchase" &&
    normalized.horizon.kind !== "date" &&
    normalized.horizon.kind !== "relative_days" &&
    fallback.clarificationFields.includes("date")
  ) {
    if (!normalized.clarificationFields.includes("date")) {
      normalized.clarificationFields.push("date");
    }
  }

  normalized.clarificationFields = dedupeFields(normalized.clarificationFields);
  normalized.needsClarification = normalized.clarificationFields.length > 0;

  if (!normalized.needsClarification) {
    normalized.clarificationQuestion = null;
  } else if (!normalized.clarificationQuestion) {
    normalized.clarificationQuestion = getClarificationQuestion(normalized.clarificationFields);
  }

  return normalized;
}

export function toDecisionIntent(parsed: ParsedDecisionIntentV2): DecisionIntent {
  if (parsed.amount === null) {
    throw new Error("Cannot build DecisionIntent without amount.");
  }

  const cadence: SpendCadence =
    parsed.intentType === "recurring"
      ? parsed.cadence ?? (() => {
          throw new Error("Recurring intent requires cadence.");
        })()
      : "one_time";

  const intent: DecisionIntent = {
    intentType: parsed.intentType,
    amount: parsed.amount,
    cadence,
    horizon: parsed.horizon,
    categoryHint: parsed.categoryHint,
  };

  assertValidIntent(intent);
  return intent;
}

export async function parseDecisionIntentV2(input: string): Promise<ParsedDecisionIntentV2> {
  const baseline = fallbackParse(input);

  if (!isApiKeyValid()) {
    return baseline;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 240,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: input },
      ],
      response_format: {
        type: "json_schema",
        json_schema: JSON_SCHEMA,
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return baseline;
    }

    const raw = JSON.parse(content) as RawParsedIntentV2;
    return normalizeParsedIntent(raw, baseline);
  } catch {
    return baseline;
  }
}

export function buildParseFallbackResponse(input: string): ParsedDecisionIntentV2 {
  return fallbackParse(input);
}
