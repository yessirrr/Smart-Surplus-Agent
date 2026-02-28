"use client";

import type { UserProfile } from "@/lib/types";

interface ProfileStepProps {
  profile: UserProfile;
  name: string;
  setName: (v: string) => void;
  age: number;
  setAge: (v: number) => void;
  location: string;
  setLocation: (v: string) => void;
  riskTolerance: "low" | "medium" | "high";
  setRiskTolerance: (v: "low" | "medium" | "high") => void;
  investmentHorizon: string;
  setInvestmentHorizon: (v: string) => void;
  grossIncome: number;
  setGrossIncome: (v: number) => void;
  onContinue: () => void;
}

const RISK_OPTIONS: Array<{ value: "low" | "medium" | "high"; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const HORIZON_OPTIONS = [
  { value: "short", label: "Short-term" },
  { value: "long", label: "Long-term" },
];

export function ProfileStep({
  name,
  setName,
  age,
  setAge,
  location,
  setLocation,
  riskTolerance,
  setRiskTolerance,
  investmentHorizon,
  setInvestmentHorizon,
  grossIncome,
  setGrossIncome,
  onContinue,
}: ProfileStepProps) {
  return (
    <div>
      <h1 className="text-xl font-bold text-ws-charcoal">
        Let&apos;s make sure we have you right
      </h1>
      <p className="text-sm text-ws-grey mt-2">
        Odysseus uses this information to personalize your habit analysis and
        savings plan. Edit anything that&apos;s not correct.
      </p>

      <div className="mt-6 bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        {/* Name */}
        <FieldRow label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-sm font-bold text-ws-charcoal bg-transparent text-right w-full outline-none"
          />
        </FieldRow>

        {/* Age */}
        <FieldRow label="Age">
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(Number(e.target.value) || 0)}
            className="text-sm font-bold text-ws-charcoal bg-transparent text-right w-20 outline-none"
          />
        </FieldRow>

        {/* Location */}
        <FieldRow label="Location">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="text-sm font-bold text-ws-charcoal bg-transparent text-right w-full outline-none"
          />
        </FieldRow>

        {/* Risk Tolerance */}
        <FieldRow label="Risk Tolerance">
          <div className="flex gap-2">
            {RISK_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRiskTolerance(opt.value)}
                className={`text-xs font-bold px-3 py-1.5 rounded-[72px] transition-colors ${
                  riskTolerance === opt.value
                    ? "bg-ws-charcoal text-white"
                    : "bg-ws-light-grey text-ws-charcoal"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </FieldRow>

        {/* Investment Horizon */}
        <FieldRow label="Investment Horizon">
          <div className="flex gap-2">
            {HORIZON_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setInvestmentHorizon(opt.value)}
                className={`text-xs font-bold px-3 py-1.5 rounded-[72px] transition-colors ${
                  investmentHorizon === opt.value
                    ? "bg-ws-charcoal text-white"
                    : "bg-ws-light-grey text-ws-charcoal"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </FieldRow>

        {/* Gross Income */}
        <FieldRow label="Yearly Earnings" last>
          <div className="flex items-center justify-end gap-1">
            <span className="text-sm text-ws-grey">$</span>
            <input
              type="number"
              value={grossIncome}
              onChange={(e) => setGrossIncome(Number(e.target.value) || 0)}
              className="text-sm font-bold text-ws-charcoal bg-transparent text-right w-28 outline-none"
            />
          </div>
        </FieldRow>
      </div>

      <button
        onClick={onContinue}
        className="mt-6 w-full text-sm font-bold text-white bg-ws-charcoal rounded-[72px] py-3 hover:opacity-90 transition-opacity"
      >
        Looks Good, Let&apos;s Go
      </button>
    </div>
  );
}

function FieldRow({
  label,
  last,
  children,
}: {
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between px-6 py-4 ${
        last ? "" : "border-b border-ws-border"
      }`}
    >
      <span className="text-sm text-ws-grey shrink-0 mr-4">{label}</span>
      <div className="flex-1 flex justify-end">{children}</div>
    </div>
  );
}
