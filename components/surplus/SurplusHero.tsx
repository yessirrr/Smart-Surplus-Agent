"use client";

import { useEffect, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { useAgent } from "@/lib/agent/use-agent";
import type { SurplusNarrativeResult } from "@/lib/agent/skills/surplus-narrative";

export interface ChartDataPoint {
  month: string;
  actual: number;
  potential: number;
  actualNegative: number | null;
}

interface SurplusHeroProps {
  actualSurplus: number;
  adjustedPotentialSurplus: number;
  chartData: ChartDataPoint[];
  selectedHabits?: Array<{ name: string; category: string; monthlySpend: number }>;
  totalMonthlySavings?: number;
}

export function SurplusHero({
  actualSurplus,
  adjustedPotentialSurplus,
  chartData,
  selectedHabits,
  totalMonthlySavings,
}: SurplusHeroProps) {
  const delta = adjustedPotentialSurplus - actualSurplus;

  // 5-year compound growth: FV = PMT * ((1 + r/12)^(n*12) - 1) / (r/12)
  const r = 0.07;
  const n = 5;
  const fv =
    delta > 0
      ? delta * ((Math.pow(1 + r / 12, n * 12) - 1) / (r / 12))
      : 0;

  const {
    data: narrative,
    loading: narrativeLoading,
    generate: fetchNarrative,
  } = useAgent<SurplusNarrativeResult>("/api/agent/surplus-narrative");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (selectedHabits && selectedHabits.length > 0) {
        fetchNarrative({
          selectedHabits,
          totalMonthlySavings,
          actualSurplus,
          potentialSurplus: adjustedPotentialSurplus,
        });
      } else {
        fetchNarrative();
      }
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHabits, totalMonthlySavings]);

  return (
    <div>
      {/* Hero card */}
      <div className="bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-8">
          <div>
            <p className="text-xs text-ws-grey uppercase tracking-wide">
              Current Monthly Surplus
            </p>
            <p className="text-2xl font-bold text-ws-charcoal mt-1">
              {formatCurrency(actualSurplus)}
            </p>
          </div>
          <div>
            <p className="text-xs text-ws-grey uppercase tracking-wide">
              Potential Monthly Surplus
            </p>
            <p className="text-3xl font-bold text-ws-green mt-1">
              {formatCurrency(adjustedPotentialSurplus)}
            </p>
          </div>
        </div>

        <p className="text-sm text-ws-charcoal mt-4">
          That&apos;s{" "}
          <span className="font-bold text-ws-green">
            {formatCurrency(delta)}/month
          </span>{" "}
          you could redirect into investments.
        </p>
        <p className="text-xs text-ws-grey mt-2">
          Over 5 years at 7% average return, that could grow to{" "}
          <span className="font-bold text-ws-charcoal">
            ~{formatCurrency(fv)}
          </span>
        </p>
      </div>

      {/* Odysseus Analysis */}
      <div className="bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm">&#10024;</span>
          <p className="text-[10px] text-ws-grey uppercase tracking-wide font-medium">
            Odysseus Analysis
          </p>
        </div>
        {narrativeLoading && <NarrativeSkeleton />}
        {!narrativeLoading && narrative && (
          <>
            <p className="text-sm text-ws-charcoal leading-relaxed">
              {narrative.situationSummary} {narrative.trendAnalysis}{" "}
              {narrative.opportunityStatement}
            </p>
            <p className="text-xs text-ws-grey mt-2 leading-relaxed">
              {narrative.projectionNote}
            </p>
          </>
        )}
        {!narrativeLoading && !narrative && (
          <p className="text-xs text-ws-grey">Analysis unavailable</p>
        )}
      </div>

      {/* Trend chart */}
      <div className="bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-6 mt-4">
        <p className="text-xs text-ws-grey uppercase tracking-wide mb-4">
          Monthly Surplus - 24 Months
        </p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="fillActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(50,48,47)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="rgb(50,48,47)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="fillPotential" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0b8a3e" stopOpacity={0.14} />
                  <stop offset="100%" stopColor="#0b8a3e" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="fillActualNegative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(205,28,19)" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="rgb(205,28,19)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "rgb(104,102,100)" }}
                axisLine={false}
                tickLine={false}
                interval={2}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "rgb(104,102,100)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${v}`}
                width={50}
              />
              <ReferenceLine y={0} stroke="var(--ws-border)" />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="potential"
                stroke="#0b8a3e"
                strokeWidth={2}
                strokeDasharray="6 3"
                fill="url(#fillPotential)"
              />
              <Area
                type="monotone"
                dataKey="actual"
                stroke="rgb(50,48,47)"
                strokeWidth={2}
                fill="url(#fillActual)"
              />
              <Area
                type="monotone"
                dataKey="actualNegative"
                baseValue={0}
                stroke="none"
                fill="url(#fillActualNegative)"
                legendType="none"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-ws-charcoal rounded" />
            <span className="text-[10px] text-ws-grey">Actual surplus</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-0.5 rounded"
              style={{ borderTop: "2px dashed #0b8a3e", height: 0 }}
            />
            <span className="text-[10px] text-ws-grey">Potential surplus</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomTooltip(props: {
  active?: boolean;
  payload?: Array<{ value?: number; dataKey?: string | number }>;
  label?: string;
}) {
  const { active, payload, label } = props;
  if (!active || !payload || payload.length === 0) return null;

  const actualValue =
    typeof payload.find((entry) => entry.dataKey === "actual")?.value ===
    "number"
      ? (payload.find((entry) => entry.dataKey === "actual")?.value as number)
      : 0;

  const potentialValue =
    typeof payload.find((entry) => entry.dataKey === "potential")?.value ===
    "number"
      ? (payload.find((entry) => entry.dataKey === "potential")?.value as number)
      : 0;

  const rows = [
    { label: "Actual", value: actualValue, isPotential: false },
    { label: "Potential", value: potentialValue, isPotential: true },
  ];

  return (
    <div
      style={{
        fontSize: 12,
        borderRadius: 8,
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        backgroundColor: "#fff",
        padding: "8px 12px",
      }}
    >
      <p style={{ color: "rgb(104,102,100)", marginBottom: 4 }}>{label}</p>
      {rows.map((row) => {
        let color = "rgb(50,48,47)";
        if (row.value < 0) {
          color = "rgb(205,28,19)";
        } else if (row.isPotential) {
          color = "#0b8a3e";
        }

        const formatted =
          row.value < 0
            ? `-${formatCurrency(Math.abs(row.value))}`
            : formatCurrency(row.value);

        return (
          <p key={row.label} style={{ color, fontWeight: 600 }}>
            {row.label}: {formatted}
          </p>
        );
      })}
    </div>
  );
}

function NarrativeSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="w-full h-3 bg-ws-light-grey rounded" />
      <div className="w-5/6 h-3 bg-ws-light-grey rounded mt-2" />
      <div className="w-4/6 h-3 bg-ws-light-grey rounded mt-2" />
    </div>
  );
}

export function formatMonthLabel(dateStr: string): string {
  const [year, month] = dateStr.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const shortYear = String(year).slice(2);
  return `${months[month - 1]} '${shortYear}`;
}
