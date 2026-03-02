"use client";

import { useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface AIPillProps {
  label: string;
  size?: "sm" | "md";
  className?: string;
  interactive?: boolean;
}

const BASE_BORDER_GRADIENT =
  "linear-gradient(90deg, #4285F4, #9B72CB, #D96570, #FBBC04)";

export function AIPill({
  label,
  size = "md",
  className,
  interactive = false,
}: AIPillProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  const renderedLabel = label.toUpperCase();

  const sizeClass =
    size === "sm"
      ? "px-2.5 py-1 text-[11px]"
      : "px-3 py-1.5 text-xs";

  const rootClass = [
    "inline-flex align-middle rounded-full border border-transparent",
    "font-bold uppercase tracking-wide leading-none text-ws-charcoal",
    interactive ? "cursor-pointer" : "cursor-default",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const baseStyle: CSSProperties = {
    borderRadius: 9999,
    backgroundImage: `linear-gradient(#fff, #fff), ${BASE_BORDER_GRADIENT}`,
    backgroundOrigin: "border-box",
    backgroundClip: "padding-box, border-box",
  };

  const boxShadow =
    interactive && isHovered
      ? "0 0 0 3px rgba(66,133,244,0.10), 0 8px 20px rgba(66,133,244,0.16)"
      : "0 1px 2px rgba(0,0,0,0.06)";

  return (
    <motion.span
      className={rootClass}
      style={baseStyle}
      animate={{ boxShadow }}
      whileHover={
        interactive && !prefersReducedMotion ? { scale: 1.02 } : undefined
      }
      transition={{ duration: 0.18, ease: "easeOut" }}
      onHoverStart={() => {
        if (interactive) {
          setIsHovered(true);
        }
      }}
      onHoverEnd={() => setIsHovered(false)}
    >
      <span className={`inline-flex items-center justify-center rounded-full bg-white ${sizeClass}`}>
        {renderedLabel}
      </span>
    </motion.span>
  );
}
