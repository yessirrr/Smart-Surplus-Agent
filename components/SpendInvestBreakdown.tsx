"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { AIPill } from "@/components/ai/AIPill";
import { AITermsModal } from "@/components/ai/AITermsModal";
import { setAiOptIn, setAiTermsAccepted } from "@/lib/client/aiOptIn";
import { formatCurrency } from "@/lib/utils";
import { CHART_COLORS } from "@/lib/constants";

interface SpendInvestBreakdownProps {
  spending: number;
  investing: number;
  isAiOptInReady: boolean;
  isAiOptedIn: boolean;
  isAiTermsAccepted: boolean;
  onAiOptInChange: (value: boolean) => void;
  onAiTermsAcceptedChange: (value: boolean) => void;
}

const INVEST = 1590;

type ModalTrigger = "enable_button" | "view_button" | "toggle";

export function SpendInvestBreakdown({
  spending,
  investing: _investing,
  isAiOptInReady,
  isAiOptedIn,
  isAiTermsAccepted,
  onAiOptInChange,
  onAiTermsAcceptedChange,
}: SpendInvestBreakdownProps) {
  const cash = spending;
  const total = cash + INVEST;
  const cashPct = total > 0 ? Math.round((cash / total) * 100) : 0;
  const investPct = total > 0 ? Math.round((INVEST / total) * 100) : 0;

  const data = [
    { name: "Cash", value: cash },
    { name: "Investing", value: INVEST },
  ];

  const colors = [CHART_COLORS.spending, CHART_COLORS.investing];
  const prefersReducedMotion = useReducedMotion();

  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [termsMode, setTermsMode] = useState<"enable" | "view">("enable");
  const [modalTrigger, setModalTrigger] = useState<ModalTrigger>("enable_button");

  const enableTriggerRef = useRef<HTMLButtonElement>(null);
  const viewTriggerRef = useRef<HTMLButtonElement>(null);
  const toggleTriggerRef = useRef<HTMLButtonElement>(null);

  function openEnableTerms(trigger: ModalTrigger = "enable_button") {
    setModalTrigger(trigger);
    setTermsMode("enable");
    setIsTermsOpen(true);
  }

  function openViewTerms() {
    setModalTrigger("view_button");
    setTermsMode("view");
    setIsTermsOpen(true);
  }

  function closeTerms() {
    setIsTermsOpen(false);
  }

  function enableAiDirect() {
    setAiOptIn(true);
    onAiOptInChange(true);
  }

  function handleEnableOdysseus() {
    setAiTermsAccepted(true);
    onAiTermsAcceptedChange(true);
    setAiOptIn(true);
    onAiOptInChange(true);
  }

  function handleToggleAi() {
    if (isAiOptedIn) {
      setAiOptIn(false);
      onAiOptInChange(false);
      return;
    }

    if (isAiTermsAccepted) {
      enableAiDirect();
      return;
    }

    openEnableTerms("toggle");
  }

  const toggleTransition = prefersReducedMotion
    ? { duration: 0.12, ease: "easeOut" as const }
    : { type: "spring" as const, stiffness: 420, damping: 30, mass: 0.8 };

  let modalTriggerRef = enableTriggerRef;
  if (modalTrigger === "view_button") {
    modalTriggerRef = viewTriggerRef;
  } else if (modalTrigger === "toggle") {
    modalTriggerRef = toggleTriggerRef;
  }

  return (
    <>
      <div className="bg-ws-white rounded-[8px] border border-ws-border p-6">
        <p className="text-sm font-bold text-ws-grey uppercase tracking-wide mb-4">
          Cash vs. Invest
        </p>
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-6">
            <div className="w-28 h-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={50}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {data.map((entry, index) => (
                      <Cell key={entry.name} fill={colors[index]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CHART_COLORS.spending }}
                />
                <div>
                  <p className="text-xs text-ws-grey">Cash</p>
                  <p className="text-sm font-bold text-ws-charcoal whitespace-nowrap">
                    {formatCurrency(cash)} ({cashPct}%)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CHART_COLORS.investing }}
                />
                <div>
                  <p className="text-xs text-ws-grey">Investing</p>
                  <p className="text-sm font-bold text-ws-charcoal whitespace-nowrap">
                    {formatCurrency(INVEST)} ({investPct}%)
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full md:max-w-[240px]">
            {!isAiOptInReady ? (
              <div className="min-h-[132px] rounded-[8px] border border-ws-border bg-ws-off-white/50" />
            ) : (
              <div className="rounded-[8px] border border-ws-border bg-ws-off-white/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <AIPill label="Odysseus" size="sm" />
                      <p
                        className={`text-xs font-bold uppercase tracking-wide ${
                          isAiOptedIn ? "text-ws-green" : "text-ws-grey"
                        }`}
                      >
                        {isAiOptedIn ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <p className="text-xs text-ws-grey mt-2">
                      {isAiOptedIn
                        ? "AI insights are enabled."
                        : "Enable Odysseus AI to unlock guided insights and scenario explanations."}
                    </p>
                  </div>

                  <button
                    ref={toggleTriggerRef}
                    type="button"
                    onClick={handleToggleAi}
                    aria-pressed={isAiOptedIn}
                    aria-label={isAiOptedIn ? "Disable Odysseus AI" : "Enable Odysseus AI"}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      isAiOptedIn ? "bg-ws-charcoal" : "bg-ws-border"
                    }`}
                  >
                    <motion.span
                      className="absolute h-5 w-5 rounded-full bg-ws-white shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
                      animate={{ x: isAiOptedIn ? 22 : 2 }}
                      transition={toggleTransition}
                    />
                  </button>
                </div>

                {!isAiOptedIn && !isAiTermsAccepted ? (
                  <button
                    type="button"
                    ref={enableTriggerRef}
                    onClick={() => openEnableTerms("enable_button")}
                    className="mt-3 text-xs font-bold text-ws-charcoal hover:opacity-70 transition-opacity"
                  >
                    Review &amp; Enable
                  </button>
                ) : null}

                {isAiTermsAccepted ? (
                  <button
                    type="button"
                    ref={viewTriggerRef}
                    onClick={openViewTerms}
                    className="mt-3 text-xs font-bold text-ws-charcoal hover:opacity-70 transition-opacity"
                  >
                    View terms
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <AITermsModal
        open={isTermsOpen}
        mode={termsMode}
        onClose={closeTerms}
        onEnable={handleEnableOdysseus}
        triggerRef={modalTriggerRef}
      />
    </>
  );
}
