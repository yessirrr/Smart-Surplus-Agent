"use client";

import { useState, type FocusEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AIPill } from "@/components/ai/AIPill";
import { formatCurrency } from "@/lib/utils";

interface AgentInsightCardProps {
  habitCount: number;
  monthlySavings: number;
}

export function AgentInsightCard({
  habitCount,
  monthlySavings,
}: AgentInsightCardProps) {
  const [isPrimaryCtaActive, setIsPrimaryCtaActive] = useState(false);
  const [isPrimaryCtaNavigating, setIsPrimaryCtaNavigating] = useState(false);
  const isPrimaryCtaAnimated = isPrimaryCtaActive || isPrimaryCtaNavigating;

  function handlePrimaryCtaFocus(event: FocusEvent<HTMLAnchorElement>) {
    if (event.currentTarget.matches(":focus-visible")) {
      setIsPrimaryCtaActive(true);
    }
  }

  function handlePrimaryCtaBlur() {
    if (!isPrimaryCtaNavigating) {
      setIsPrimaryCtaActive(false);
    }
  }

  function handlePrimaryCtaKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    if (event.key === "Enter" || event.key === " ") {
      setIsPrimaryCtaActive(true);
    }
  }

  function handlePrimaryCtaClick() {
    setIsPrimaryCtaNavigating(true);
    setIsPrimaryCtaActive(true);
  }

  return (
    <div className="bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-6">
      <p className="text-sm font-bold text-ws-charcoal">
        <AIPill label="Odysseus" size="sm" className="mr-1" /> detected {habitCount} spending habits
      </p>
      <p className="text-xs text-ws-grey mt-1">
        You could save up to {formatCurrency(monthlySavings)}/month by
        adjusting your habits
      </p>

      <div className="flex gap-3 mt-3">
        <Link
          href="/habits"
          aria-label="Set Up a Habit Goal"
          onMouseEnter={() => setIsPrimaryCtaActive(true)}
          onMouseLeave={() => {
            if (!isPrimaryCtaNavigating) {
              setIsPrimaryCtaActive(false);
            }
          }}
          onMouseDown={() => setIsPrimaryCtaActive(true)}
          onFocus={handlePrimaryCtaFocus}
          onBlur={handlePrimaryCtaBlur}
          onKeyDown={handlePrimaryCtaKeyDown}
          onClick={handlePrimaryCtaClick}
          className="relative flex-1 text-center text-sm font-bold text-white bg-ws-charcoal rounded-[72px] py-3 hover:opacity-90 transition-opacity overflow-hidden"
        >
          <span className="sr-only">Set Up a Habit Goal</span>
          <span aria-hidden className="relative block h-5 w-full">
            <motion.span
              className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white"
              initial={false}
              style={{ opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" }}
              animate={
                isPrimaryCtaAnimated
                  ? { opacity: 0, y: -10, filter: "blur(2px)" }
                  : { opacity: 1, y: 0, filter: "blur(0px)" }
              }
              transition={{ duration: 0.26, ease: "easeOut" }}
            >
              Set Up a Habit Goal
            </motion.span>
            <motion.span
              className="absolute inset-0 flex items-center justify-center text-[13px] font-medium tracking-[0.02em] text-white/80"
              initial={false}
              style={{ opacity: 0, transform: "translateY(12px)", filter: "blur(2px)" }}
              animate={
                isPrimaryCtaAnimated
                  ? { opacity: 1, y: 0, filter: "blur(0px)" }
                  : { opacity: 0, y: 12, filter: "blur(2px)" }
              }
              transition={{ duration: 0.26, ease: "easeOut" }}
            >
              Tie yourself to the mast
            </motion.span>
          </span>
        </Link>
        <Link
          href="/surplus"
          className="flex-1 text-center text-sm font-bold text-ws-charcoal bg-ws-light-grey rounded-[72px] py-3 hover:opacity-80 transition-opacity"
        >
          View Surplus Plan &rarr;
        </Link>
      </div>
    </div>
  );
}