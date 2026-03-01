"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { useAgent, type AllocationReasoningResult } from "@/lib/agent";

type PlanId = "conservative" | "balanced" | "growth";

interface Plan {
  id: PlanId;
  name: string;
  allocation: string;
  bondsPct: number;
  equityPct: number;
  rate: number;
  riskLevel: number;
  description: string;
  recommended?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "conservative",
    name: "Conservative",
    allocation: "80% Bonds ETF / 20% Equity ETF",
    bondsPct: 80,
    equityPct: 20,
    rate: 0.04,
    riskLevel: 1,
    description: "Steady and predictable. Prioritizes capital preservation.",
  },
  {
    id: "balanced",
    name: "Balanced",
    allocation: "40% Bonds ETF / 60% Equity ETF",
    bondsPct: 40,
    equityPct: 60,
    rate: 0.07,
    riskLevel: 2,
    description: "Growth with guardrails. A classic long-term approach.",
    recommended: true,
  },
  {
    id: "growth",
    name: "Growth",
    allocation: "10% Bonds ETF / 90% Equity ETF",
    bondsPct: 10,
    equityPct: 90,
    rate: 0.1,
    riskLevel: 3,
    description: "Maximum growth potential. Comfortable with volatility.",
  },
];

interface AllocationPickerProps {
  monthlySavings: number;
}

function futureValue(pmt: number, rate: number, years: number): number {
  const r = rate / 12;
  const periods = years * 12;
  if (r === 0) return pmt * periods;
  return pmt * ((Math.pow(1 + r, periods) - 1) / r);
}

export function AllocationPicker({ monthlySavings }: AllocationPickerProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("balanced");
  const [showConfirm, setShowConfirm] = useState(false);
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const {
    data: reasoning,
    loading: reasoningLoading,
    generate: fetchReasoning,
  } = useAgent<AllocationReasoningResult>("/api/agent/allocation-reasoning");

  const plan = PLANS.find((p) => p.id === selectedPlan)!;

  useEffect(() => {
    fetchReasoning({
      riskTolerance: "medium",
      horizon: "long",
      planName: plan.name,
      bondsPct: plan.bondsPct,
      equityPct: plan.equityPct,
      expectedReturn: plan.rate,
      monthlySavings,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan]);

  const fv1 = futureValue(monthlySavings, plan.rate, 1);
  const fv5 = futureValue(monthlySavings, plan.rate, 5);
  const fv10 = futureValue(monthlySavings, plan.rate, 10);

  // Projection chart data (yearly points for the selected plan)
  const projectionData = Array.from({ length: 11 }, (_, i) => ({
    year: `Year ${i}`,
    value: Math.round(futureValue(monthlySavings, plan.rate, i)),
  }));

  if (confirmed) {
    return (
      <div>
        <h2 className="text-lg font-bold text-ws-charcoal">
          Put Your Surplus to Work
        </h2>
        <div className="mt-4 bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0b8a3e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <p className="text-lg font-bold text-ws-charcoal mt-4">
            Your plan is set
          </p>
          <p className="text-sm text-ws-grey mt-2">
            Odysseus will notify you when surplus is available to invest.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm font-bold text-white bg-ws-charcoal rounded-[72px] px-8 py-3 hover:opacity-90 transition-opacity"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-ws-charcoal">
        Put Your Surplus to Work
      </h2>
      <p className="text-sm text-ws-grey mt-1">
        Choose how you&apos;d like to allocate your potential savings. This is
        illustrative — not investment advice.
      </p>

      {/* Plan cards */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PLANS.map((p) => {
          const active = p.id === selectedPlan;
          const fv5Plan = futureValue(monthlySavings, p.rate, 5);
          return (
            <button
              key={p.id}
              onClick={() => {
                setSelectedPlan(p.id);
                setShowConfirm(false);
                setCheck1(false);
                setCheck2(false);
              }}
              className={`relative text-left bg-ws-white rounded-[8px] p-4 transition-all ${
                active
                  ? "border-2 border-ws-charcoal shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
                  : "border border-ws-border shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
              }`}
            >
              {p.recommended && (
                <span className="absolute top-3 right-3 text-[10px] font-bold text-ws-green bg-green-50 rounded-[72px] px-2 py-0.5">
                  Recommended
                </span>
              )}
              <p className="text-sm font-bold text-ws-charcoal">{p.name}</p>
              <p className="text-xs text-ws-grey mt-1">{p.allocation}</p>
              <p className="text-xs text-ws-grey mt-0.5">
                ~{(p.rate * 100).toFixed(0)}% expected annual return
              </p>

              {/* Risk dots */}
              <div className="flex gap-1 mt-2">
                {[1, 2, 3].map((level) => (
                  <span
                    key={level}
                    className={`w-2 h-2 rounded-full ${
                      level <= p.riskLevel ? "bg-ws-charcoal" : "bg-ws-light-grey"
                    }`}
                  />
                ))}
              </div>

              <p className="text-lg font-bold text-ws-green mt-2">
                ~{formatCurrency(fv5Plan)}
              </p>
              <p className="text-[10px] text-ws-grey">projected in 5 years</p>

              <p className="text-xs text-ws-grey mt-2">{p.description}</p>
            </button>
          );
        })}
      </div>

      {/* Summary panel */}
      <div className="mt-4 bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-6">
        <p className="text-sm text-ws-charcoal">
          If you invest{" "}
          <span className="font-bold text-ws-green">
            {formatCurrency(monthlySavings)}/month
          </span>{" "}
          in a{" "}
          <span className="font-bold">{plan.name}</span> portfolio:
        </p>

        <div className="flex gap-6 mt-4">
          <div>
            <p className="text-xs text-ws-grey">In 1 year</p>
            <p className="text-sm font-bold text-ws-charcoal">
              ~{formatCurrency(fv1)}
            </p>
          </div>
          <div>
            <p className="text-xs text-ws-grey">In 5 years</p>
            <p className="text-sm font-bold text-ws-charcoal">
              ~{formatCurrency(fv5)}
            </p>
          </div>
          <div>
            <p className="text-xs text-ws-grey">In 10 years</p>
            <p className="text-sm font-bold text-ws-green">
              ~{formatCurrency(fv10)}
            </p>
          </div>
        </div>

        {/* Projection chart */}
        <div className="h-44 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={projectionData}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <XAxis
                dataKey="year"
                tick={{ fontSize: 10, fill: "rgb(104,102,100)" }}
                axisLine={false}
                tickLine={false}
                interval={1}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "rgb(104,102,100)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                }
                width={45}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
                formatter={(value: number | undefined) => [
                  formatCurrency(value ?? 0),
                  "Projected value",
                ]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0b8a3e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Why this plan? */}
      <div className="mt-4 bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm">&#10024;</span>
          <p className="text-[10px] text-ws-grey uppercase tracking-wide font-medium">
            Why this plan?
          </p>
        </div>
        {reasoningLoading && <ReasoningSkeleton />}
        {!reasoningLoading && reasoning && (
          <>
            <p className="text-sm text-ws-charcoal leading-relaxed">
              {reasoning.reasoning}
            </p>
            <p className="text-xs text-ws-charcoal mt-2 leading-relaxed">
              {reasoning.riskExplanation}
            </p>
            <p className="text-xs text-ws-charcoal mt-2 leading-relaxed">
              {reasoning.historicalContext}
            </p>
            <p className="text-[10px] text-ws-grey mt-3 italic leading-relaxed">
              {reasoning.caveat}
            </p>
          </>
        )}
        {!reasoningLoading && !reasoning && (
          <p className="text-xs text-ws-grey">Reasoning unavailable</p>
        )}
      </div>

      {/* CTA / Confirmation */}
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="mt-6 w-full text-sm font-bold text-white bg-ws-charcoal rounded-[72px] py-3 hover:opacity-90 transition-opacity"
        >
          I Want to Start Investing
        </button>
      ) : (
        <div className="mt-4 bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-6">
          <p className="text-sm font-bold text-ws-charcoal">
            Confirm Your Investment Plan
          </p>
          <div className="mt-3 space-y-1 text-xs text-ws-grey">
            <p>Allocation: {plan.allocation}</p>
            <p>Monthly amount: {formatCurrency(monthlySavings)}</p>
            <p>Risk level: {plan.name}</p>
          </div>

          <div className="mt-4 space-y-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={check1}
                onChange={(e) => setCheck1(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded accent-ws-charcoal shrink-0"
              />
              <span className="text-xs text-ws-charcoal">
                I understand this is illustrative and based on historical
                averages, not guaranteed returns
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={check2}
                onChange={(e) => setCheck2(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded accent-ws-charcoal shrink-0"
              />
              <span className="text-xs text-ws-charcoal">
                I want Odysseus to suggest this allocation when surplus is
                available
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => {
                setShowConfirm(false);
                setCheck1(false);
                setCheck2(false);
              }}
              className="text-sm font-bold text-ws-grey hover:text-ws-charcoal transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={() => setConfirmed(true)}
              disabled={!check1 || !check2}
              className="flex-1 text-sm font-bold text-white bg-ws-charcoal rounded-[72px] py-3 transition-opacity disabled:opacity-40 hover:opacity-90"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReasoningSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="w-full h-3 bg-ws-light-grey rounded" />
      <div className="w-5/6 h-3 bg-ws-light-grey rounded mt-2" />
      <div className="w-full h-3 bg-ws-light-grey rounded mt-2" />
      <div className="w-3/4 h-3 bg-ws-light-grey rounded mt-2" />
    </div>
  );
}
