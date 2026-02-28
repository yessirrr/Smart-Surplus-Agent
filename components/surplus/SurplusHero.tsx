"use client";

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

export interface ChartDataPoint {
  month: string;
  actualSurplus: number;
  potentialSurplus: number;
  actual: number;
  potential: number;
  actualPositive: number | null;
  actualNegative: number | null;
  potentialPositive: number | null;
  potentialNegative: number | null;
}

interface SurplusHeroProps {
  actualSurplus: number;
  adjustedPotentialSurplus: number;
  chartData: ChartDataPoint[];
}

export function SurplusHero({
  actualSurplus,
  adjustedPotentialSurplus,
  chartData,
}: SurplusHeroProps) {
  const delta = adjustedPotentialSurplus - actualSurplus;

  // 5-year compound growth: FV = PMT * ((1 + r/12)^(n*12) - 1) / (r/12)
  const r = 0.07;
  const n = 5;
  const fv =
    delta > 0
      ? delta * ((Math.pow(1 + r / 12, n * 12) - 1) / (r / 12))
      : 0;

  const allValues = chartData.flatMap((point) => [
    point.actualSurplus,
    point.potentialSurplus,
  ]);
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0;
  const minValue = allValues.length > 0 ? Math.min(...allValues) : 0;
  const zeroOffset =
    maxValue <= 0 ? 0 : minValue >= 0 ? 1 : maxValue / (maxValue - minValue);
  const zeroPercent = `${zeroOffset * 100}%`;

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
                <linearGradient id="actualStrokeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(50,48,47)" />
                  <stop offset={zeroPercent} stopColor="rgb(50,48,47)" />
                  <stop offset={zeroPercent} stopColor="rgb(205,28,19)" />
                  <stop offset="100%" stopColor="rgb(205,28,19)" />
                </linearGradient>
                <linearGradient id="potentialStrokeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0b8a3e" />
                  <stop offset={zeroPercent} stopColor="#0b8a3e" />
                  <stop offset={zeroPercent} stopColor="rgb(205,28,19)" />
                  <stop offset="100%" stopColor="rgb(205,28,19)" />
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
                dataKey="potentialSurplus"
                stroke="url(#potentialStrokeGradient)"
                strokeWidth={2}
                strokeDasharray="6 3"
                fill="none"
                legendType="none"
              />
              <Area
                type="monotone"
                dataKey="actualSurplus"
                stroke="url(#actualStrokeGradient)"
                strokeWidth={2}
                fill="none"
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
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-ws-red rounded" />
            <span className="text-[10px] text-ws-grey">Negative surplus</span>
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
    typeof payload.find((entry) => entry.dataKey === "actualSurplus")?.value ===
    "number"
      ? (payload.find((entry) => entry.dataKey === "actualSurplus")?.value as number)
      : 0;

  const potentialValue =
    typeof payload.find((entry) => entry.dataKey === "potentialSurplus")?.value ===
    "number"
      ? (payload.find((entry) => entry.dataKey === "potentialSurplus")?.value as number)
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

export function formatMonthLabel(dateStr: string): string {
  const [year, month] = dateStr.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const shortYear = String(year).slice(2);
  return `${months[month - 1]} '${shortYear}`;
}
