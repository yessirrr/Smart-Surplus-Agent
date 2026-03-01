import "server-only";

import { readFile } from "fs/promises";
import path from "path";

export interface StockCsvPricePoint {
  date: string;
  close: number;
}

export interface StockCsvSeries {
  prices: StockCsvPricePoint[];
  latestClose: number;
  changePercent: number;
}

const TICKER_FILE_OVERRIDES: Record<string, string> = {
  AMZN: "Amazon",
  AAPL: "Apple",
  SBUX: "Starbucks",
  MCD: "McDonalds",
  NFLX: "Netflix",
  SPOT: "Spotify",
  SHOP: "Shopify",
  UBER: "Uber",
  LYFT: "Lyft",
  ABNB: "Airbnb",
  BBY: "BestBuy",
  CMG: "Chipotle",
  "L.TO": "Loblaw",
  "RCI-B.TO": "Rogers",
  QSR: "QSR",
  DASH: "DoorDash",
};

const cache = new Map<string, StockCsvSeries>();

export async function getStockSeries(ticker: string): Promise<StockCsvSeries> {
  const key = ticker.toUpperCase();
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const csv = await readTickerCsv(key);
  const parsed = parseStockCsv(csv);
  if (parsed.prices.length === 0) {
    throw new Error(`No valid rows found for ticker ${key}`);
  }

  cache.set(key, parsed);
  return parsed;
}

async function readTickerCsv(ticker: string): Promise<string> {
  const root = process.cwd();
  const base = TICKER_FILE_OVERRIDES[ticker] ?? ticker;
  const names = [`${base}.csv`, `${ticker}.csv`];
  const dirs = ["Stock", "Stock Data"];

  for (const dir of dirs) {
    for (const name of names) {
      const candidate = path.join(root, dir, name);
      try {
        return await readFile(candidate, "utf8");
      } catch {
        // continue searching candidate locations
      }
    }
  }

  throw new Error(`CSV file not found for ticker ${ticker}`);
}

function parseStockCsv(csvText: string): StockCsvSeries {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return { prices: [], latestClose: 0, changePercent: 0 };
  }

  const header = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase());
  const dateIndex = header.indexOf("date");
  const closeIndex =
    header.indexOf("close/last") >= 0
      ? header.indexOf("close/last")
      : header.indexOf("close");

  if (dateIndex < 0 || closeIndex < 0) {
    return { prices: [], latestClose: 0, changePercent: 0 };
  }

  const prices: StockCsvPricePoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length <= Math.max(dateIndex, closeIndex)) {
      continue;
    }

    const date = normalizeDate(row[dateIndex]);
    const close = parseCurrencyNumber(row[closeIndex]);

    if (!date || close === null) {
      continue;
    }

    prices.push({ date, close });
  }

  prices.sort((a, b) => a.date.localeCompare(b.date));
  const windowed = trimToSixCalendarMonths(prices);

  if (windowed.length === 0) {
    return { prices: [], latestClose: 0, changePercent: 0 };
  }

  const first = windowed[0].close;
  const latestClose = windowed[windowed.length - 1].close;
  const changePercent = first === 0 ? 0 : ((latestClose - first) / first) * 100;

  return {
    prices: windowed,
    latestClose,
    changePercent,
  };
}

function trimToSixCalendarMonths(
  prices: StockCsvPricePoint[]
): StockCsvPricePoint[] {
  if (prices.length === 0) return prices;

  const latest = parseDateParts(prices[prices.length - 1].date);
  if (!latest) return prices;

  const latestMonthIndex = latest.year * 12 + latest.month;
  const startMonthIndex = latestMonthIndex - 5;

  const filtered = prices.filter((point) => {
    const parsed = parseDateParts(point.date);
    if (!parsed) return false;
    const monthIndex = parsed.year * 12 + parsed.month;
    return monthIndex >= startMonthIndex && monthIndex <= latestMonthIndex;
  });

  return filtered.length > 0 ? filtered : prices;
}

function parseDateParts(
  isoDate: string
): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
  };
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  out.push(current);
  return out;
}

function parseCurrencyNumber(raw: string): number | null {
  const cleaned = raw.replace(/\$/g, "").replace(/,/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoMatch) {
    return value;
  }

  const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(value);
  if (!usMatch) {
    return null;
  }

  const month = Number(usMatch[1]);
  const day = Number(usMatch[2]);
  const yearRaw = Number(usMatch[3]);
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;

  if (!month || !day || !year) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
