"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  getLogoSrc,
  normalizeName,
  resolveLogoKey,
} from "@/lib/market/logoLookup";

interface CompanyLogoProps {
  companyName?: string;
  merchantName?: string;
  size?: "sm" | "md";
  fallbackText?: string;
  fallbackColor?: string;
}

type LogoOpticalOverride = {
  scale?: number;
  translateX?: number;
  translateY?: number;
  fit?: "contain" | "cover";
  inset?: "default" | "none" | "spacious";
  surface?: "default" | "app" | "app-no-ring";
  box?: number;
  clipRounded?: boolean;
};

const LOGO_OPTICAL_OVERRIDES: Record<string, LogoOpticalOverride> = {
  // Subscription merchants: targeted size tuning.
  "netflix-icon": {
    scale: 1.41,
    fit: "contain",
    inset: "spacious",
    surface: "app",
    box: 40,
    clipRounded: true,
  },
  netflix: {
    scale: 1.41,
    fit: "contain",
    inset: "spacious",
    surface: "app",
    box: 40,
    clipRounded: true,
  },
  "spotify-tile": {
    scale: 1.31,
    fit: "contain",
    inset: "spacious",
    surface: "app-no-ring",
    box: 40,
  },
  spotify: {
    scale: 1.31,
    fit: "contain",
    inset: "spacious",
    surface: "app-no-ring",
    box: 40,
  },
  "apple-logo-2": {
    scale: 1.06,
    fit: "contain",
    inset: "spacious",
    surface: "app",
  },
  apple: {
    scale: 1.06,
    fit: "contain",
    inset: "spacious",
    surface: "app",
  },

  // Uber family.
  "uber-logo-6": { scale: 1.38, fit: "cover" },
  uber: { scale: 1.38, fit: "cover" },
  "uber-technologies-inc": { scale: 1.38, fit: "cover" },
  "uber-eats-logo-1": { scale: 1.16 },
  ubereats: { scale: 1.16 },

  // Remaining brand logos.
  "amazon-logo-14": {
    scale: 1.11,
    fit: "contain",
    inset: "spacious",
    surface: "app-no-ring",
    box: 40,
  },
  amazon: {
    scale: 1.11,
    fit: "contain",
    inset: "spacious",
    surface: "app-no-ring",
    box: 40,
  },
  "best-buy-logo-2": { scale: 1.16 },
  "chipotle-logo-2": { scale: 1.14 },
  chipotle: { scale: 1.14 },
  "doordash-logo": { scale: 1.16 },
  doordash: { scale: 1.16 },
  "lyft-logo-2": { scale: 1.16 },
  lyft: { scale: 1.16 },
  "mcdonald-logo-2": { scale: 1.14 },
  mcdonalds: { scale: 1.14 },
  "rogers-logo-6": { scale: 1.16 },
  rogers: { scale: 1.16 },
  "shopify-logo-2": { scale: 1.15 },
  shopify: { scale: 1.15 },
  "starbucks-logo-1": { scale: 1.12 },
  starbucks: { scale: 1.12 },
  "tim-hortons-logo-2": { scale: 1.16 },
  "tim-hortons": { scale: 1.16 },
  "airbnb-logo-2": { scale: 1.16 },
  airbnb: { scale: 1.16 },
};

const warnedMissingLogoKeys = new Set<string>();

function getLogoFileKey(logoSrc: string | null): string {
  if (!logoSrc) return "";

  try {
    const fileName = decodeURIComponent(logoSrc.split("/").pop() ?? "");
    const baseName = fileName.replace(/\.svg$/i, "");
    return normalizeName(baseName);
  } catch {
    return "";
  }
}

export function CompanyLogo({
  companyName,
  merchantName,
  size = "md",
  fallbackText = "?",
  fallbackColor = "rgb(50,48,47)",
}: CompanyLogoProps) {
  const [imgError, setImgError] = useState(false);

  const companyKey = useMemo(
    () => resolveLogoKey(companyName ?? ""),
    [companyName]
  );
  const merchantKey = useMemo(
    () => resolveLogoKey(merchantName ?? ""),
    [merchantName]
  );

  const logoSrc = useMemo(() => {
    if (companyKey) {
      const byCompany = getLogoSrc(companyKey);
      if (byCompany) return byCompany;
    }
    if (merchantKey) {
      return getLogoSrc(merchantKey);
    }
    return null;
  }, [companyKey, merchantKey]);

  const normalizedCompanyKey = useMemo(
    () => normalizeName(companyKey),
    [companyKey]
  );
  const normalizedMerchantKey = useMemo(
    () => normalizeName(merchantKey),
    [merchantKey]
  );
  const logoFileKey = useMemo(() => getLogoFileKey(logoSrc), [logoSrc]);

  const optical = useMemo(() => {
    return (
      LOGO_OPTICAL_OVERRIDES[logoFileKey] ??
      LOGO_OPTICAL_OVERRIDES[normalizedCompanyKey] ??
      LOGO_OPTICAL_OVERRIDES[normalizedMerchantKey] ??
      {
        scale: 1,
        fit: "contain",
        inset: "default",
        surface: "default",
      }
    );
  }, [logoFileKey, normalizedCompanyKey, normalizedMerchantKey]);

  if (
    process.env.NODE_ENV !== "production" &&
    !logoSrc &&
    (companyKey || merchantKey)
  ) {
    const warnKey = `${companyKey}|${merchantKey}`;
    if (!warnedMissingLogoKeys.has(warnKey)) {
      warnedMissingLogoKeys.add(warnKey);
      console.warn(
        "Logo missing for:",
        merchantName ?? companyName ?? "(unknown)",
        "resolvedKey:",
        merchantKey || companyKey || ""
      );
    }
  }

  const box = optical.box ?? (size === "sm" ? 32 : 36);
  const fitMode = optical.fit ?? "contain";
  const insetMode = optical.inset ?? "default";
  const surfaceMode = optical.surface ?? "default";

  const insetClass =
    insetMode === "none" ? "p-0" : insetMode === "spacious" ? "p-1.5" : "p-1";
  const surfaceClass =
    surfaceMode === "app"
      ? "bg-white ring-1 ring-black/5 rounded-xl"
      : surfaceMode === "app-no-ring"
        ? "bg-white rounded-xl"
        : "bg-ws-light-grey rounded-[10px]";
  const imageClipClass = optical.clipRounded
    ? "overflow-hidden rounded-[10px]"
    : "";

  return (
    <div
      className={`shrink-0 overflow-hidden flex items-center justify-center ${insetClass} ${surfaceClass}`}
      style={{ width: box, height: box }}
    >
      {logoSrc && !imgError ? (
        <div
          className={`relative w-full h-full ${imageClipClass}`}
          style={{
            transform: `translate(${optical.translateX ?? 0}px, ${
              optical.translateY ?? 0
            }px) scale(${optical.scale ?? 1})`,
            transformOrigin: "center",
          }}
        >
          <Image
            src={logoSrc}
            alt={companyName ?? merchantName ?? "Company logo"}
            fill
            sizes={`${box}px`}
            className={fitMode === "cover" ? "object-cover" : "object-contain"}
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div
          className="w-full h-full rounded-[8px] flex items-center justify-center text-white font-bold"
          style={{
            backgroundColor: fallbackColor,
            fontSize: size === "sm" ? 12 : 13,
          }}
        >
          {fallbackText.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}







