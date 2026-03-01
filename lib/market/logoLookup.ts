export type LogoSize = "sm" | "md";

const COMMON_COMPANY_SUFFIXES = new Set([
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "co",
  "company",
  "limited",
  "ltd",
  "sa",
  "plc",
]);

export function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9\s_-]/g, " ")
    .replace(/[\s_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function resolveLogoKey(merchantOrCompanyName: string): string {
  const trimmed = merchantOrCompanyName.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  const base = trimmed.split(" - ")[0].trim();
  const noParen = base.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  return noParen;
}

const LOGO_FILE_NAMES = [
  "AAPL.svg",
  "ABNB.svg",
  "airbnb-logo-2.svg",
  "Amazon_logo-14.svg",
  "AMZN.svg",
  "apple-logo-2.svg",
  "BBY.svg",
  "Best-Buy-Logo-2.svg",
  "Chipotle-Logo-2.svg",
  "CMG.svg",
  "DASH.svg",
  "doordash-logo.svg",
  "L.TO.svg",
  "Lyft-Logo-2.svg",
  "LYFT.svg",
  "MCD.svg",
  "mcdonald-logo-2.svg",
  "Netflix_icon.svg",
  "NFLX.svg",
  "QSR.svg",
  "RCI-B.TO.svg",
  "Rogers-Logo-6.svg",
  "SBUX.svg",
  "SHOP.svg",
  "Shopify-Logo-2.svg",
  "SPOT.svg",
  "spotify-tile.svg",
  "starbucks-logo-1.svg",
  "Tim-Hortons-Logo-2.svg",
  "uber-eats-logo-1.svg",
  "Uber-Logo-6.svg",
  "UBER.svg",
] as const;

const LOGO_BY_NORMALIZED_FILE_BASENAME = new Map<string, string>(
  LOGO_FILE_NAMES.map((file) => {
    const baseName = file.replace(/\.svg$/i, "");
    return [normalizeName(baseName), file];
  })
);

const LOGO_OVERRIDES = new Map<string, string>([
  [normalizeName("amazon"), "Amazon_logo-14.svg"],
  [normalizeName("amazon.com inc."), "Amazon_logo-14.svg"],
  [normalizeName("apple"), "apple-logo-2.svg"],
  [normalizeName("apple inc."), "apple-logo-2.svg"],
  [normalizeName("starbucks"), "starbucks-logo-1.svg"],
  [normalizeName("starbucks corporation"), "starbucks-logo-1.svg"],
  [normalizeName("mcdonalds"), "mcdonald-logo-2.svg"],
  [normalizeName("mcdonalds corporation"), "mcdonald-logo-2.svg"],
  [normalizeName("netflix"), "Netflix_icon.svg"],
  [normalizeName("netflix inc."), "Netflix_icon.svg"],
  [normalizeName("spotify"), "spotify-tile.svg"],
  [normalizeName("spotify technology s.a."), "spotify-tile.svg"],
  [normalizeName("shopify"), "Shopify-Logo-2.svg"],
  [normalizeName("shopify inc."), "Shopify-Logo-2.svg"],
  [normalizeName("uber"), "Uber-Logo-6.svg"],
  [normalizeName("uber technologies inc."), "Uber-Logo-6.svg"],
  [normalizeName("ubereats"), "uber-eats-logo-1.svg"],
  [normalizeName("lyft"), "Lyft-Logo-2.svg"],
  [normalizeName("lyft inc."), "Lyft-Logo-2.svg"],
  [normalizeName("airbnb"), "airbnb-logo-2.svg"],
  [normalizeName("airbnb inc."), "airbnb-logo-2.svg"],
  [normalizeName("best buy"), "Best-Buy-Logo-2.svg"],
  [normalizeName("best buy co. inc."), "Best-Buy-Logo-2.svg"],
  [normalizeName("chipotle"), "Chipotle-Logo-2.svg"],
  [normalizeName("chipotle mexican grill inc."), "Chipotle-Logo-2.svg"],
  [normalizeName("rogers"), "Rogers-Logo-6.svg"],
  [normalizeName("rogers communications inc."), "Rogers-Logo-6.svg"],
  [normalizeName("restaurant brands international"), "Tim-Hortons-Logo-2.svg"],
  [normalizeName("tim hortons"), "Tim-Hortons-Logo-2.svg"],
  [normalizeName("doordash"), "doordash-logo.svg"],
  [normalizeName("doordash inc."), "doordash-logo.svg"],
]);

function toPublicLogoPath(fileName: string): string {
  return "/logos/" + encodeURIComponent(fileName);
}

function stripCommonSuffixes(normalized: string): string {
  const parts = normalized.split("-").filter(Boolean);
  while (parts.length > 1 && COMMON_COMPANY_SUFFIXES.has(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts.join("-");
}

export function getLogoSrc(key: string): string | null {
  const normalized = normalizeName(key);
  if (!normalized) return null;

  const override = LOGO_OVERRIDES.get(normalized);
  if (override) {
    return toPublicLogoPath(override);
  }

  const direct = LOGO_BY_NORMALIZED_FILE_BASENAME.get(normalized);
  if (direct) {
    return toPublicLogoPath(direct);
  }

  const withoutSuffix = stripCommonSuffixes(normalized);
  if (withoutSuffix && withoutSuffix !== normalized) {
    const suffixOverride = LOGO_OVERRIDES.get(withoutSuffix);
    if (suffixOverride) {
      return toPublicLogoPath(suffixOverride);
    }

    const suffixDirect = LOGO_BY_NORMALIZED_FILE_BASENAME.get(withoutSuffix);
    if (suffixDirect) {
      return toPublicLogoPath(suffixDirect);
    }
  }

  return null;
}
