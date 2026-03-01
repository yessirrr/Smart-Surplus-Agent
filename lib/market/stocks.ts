export interface StockInfo {
  ticker: string;
  companyName: string;
  exchange: string;
  mockPrice: number;
  mockChange: number; // percentage
  mockHistory: number[]; // 30 data points
}

function generateHistory(base: number, change: number): number[] {
  const points: number[] = [];
  const end = base;
  const start = end / (1 + change / 100);
  for (let i = 0; i < 30; i++) {
    const progress = i / 29;
    const trend = start + (end - start) * progress;
    const noise = trend * (Math.sin(i * 1.7) * 0.015 + Math.cos(i * 2.3) * 0.01);
    points.push(Math.round((trend + noise) * 100) / 100);
  }
  return points;
}

const STOCK_MAP: Record<string, StockInfo> = {
  Amazon: {
    ticker: "AMZN",
    companyName: "Amazon.com Inc.",
    exchange: "NASDAQ",
    mockPrice: 198.42,
    mockChange: 2.34,
    mockHistory: generateHistory(198.42, 2.34),
  },
  "Amazon.ca": {
    ticker: "AMZN",
    companyName: "Amazon.com Inc.",
    exchange: "NASDAQ",
    mockPrice: 198.42,
    mockChange: 2.34,
    mockHistory: generateHistory(198.42, 2.34),
  },
  Apple: {
    ticker: "AAPL",
    companyName: "Apple Inc.",
    exchange: "NASDAQ",
    mockPrice: 227.63,
    mockChange: 1.12,
    mockHistory: generateHistory(227.63, 1.12),
  },
  "Apple Store": {
    ticker: "AAPL",
    companyName: "Apple Inc.",
    exchange: "NASDAQ",
    mockPrice: 227.63,
    mockChange: 1.12,
    mockHistory: generateHistory(227.63, 1.12),
  },
  Starbucks: {
    ticker: "SBUX",
    companyName: "Starbucks Corporation",
    exchange: "NASDAQ",
    mockPrice: 103.15,
    mockChange: -0.87,
    mockHistory: generateHistory(103.15, -0.87),
  },
  "McDonald's": {
    ticker: "MCD",
    companyName: "McDonald's Corporation",
    exchange: "NYSE",
    mockPrice: 292.41,
    mockChange: 0.53,
    mockHistory: generateHistory(292.41, 0.53),
  },
  Netflix: {
    ticker: "NFLX",
    companyName: "Netflix Inc.",
    exchange: "NASDAQ",
    mockPrice: 721.28,
    mockChange: 4.15,
    mockHistory: generateHistory(721.28, 4.15),
  },
  Spotify: {
    ticker: "SPOT",
    companyName: "Spotify Technology S.A.",
    exchange: "NYSE",
    mockPrice: 318.74,
    mockChange: 3.22,
    mockHistory: generateHistory(318.74, 3.22),
  },
  Shopify: {
    ticker: "SHOP",
    companyName: "Shopify Inc.",
    exchange: "NYSE",
    mockPrice: 107.56,
    mockChange: 1.89,
    mockHistory: generateHistory(107.56, 1.89),
  },
  Uber: {
    ticker: "UBER",
    companyName: "Uber Technologies Inc.",
    exchange: "NYSE",
    mockPrice: 78.32,
    mockChange: -1.45,
    mockHistory: generateHistory(78.32, -1.45),
  },
  UberEats: {
    ticker: "UBER",
    companyName: "Uber Technologies Inc.",
    exchange: "NYSE",
    mockPrice: 78.32,
    mockChange: -1.45,
    mockHistory: generateHistory(78.32, -1.45),
  },
  Lyft: {
    ticker: "LYFT",
    companyName: "Lyft Inc.",
    exchange: "NASDAQ",
    mockPrice: 16.83,
    mockChange: -2.31,
    mockHistory: generateHistory(16.83, -2.31),
  },
  Airbnb: {
    ticker: "ABNB",
    companyName: "Airbnb Inc.",
    exchange: "NASDAQ",
    mockPrice: 153.47,
    mockChange: 0.78,
    mockHistory: generateHistory(153.47, 0.78),
  },
  "Best Buy": {
    ticker: "BBY",
    companyName: "Best Buy Co. Inc.",
    exchange: "NYSE",
    mockPrice: 86.21,
    mockChange: -0.64,
    mockHistory: generateHistory(86.21, -0.64),
  },
  Chipotle: {
    ticker: "CMG",
    companyName: "Chipotle Mexican Grill Inc.",
    exchange: "NYSE",
    mockPrice: 62.18,
    mockChange: 1.37,
    mockHistory: generateHistory(62.18, 1.37),
  },
  Loblaws: {
    ticker: "L.TO",
    companyName: "Loblaw Companies Limited",
    exchange: "TSX",
    mockPrice: 178.93,
    mockChange: 0.42,
    mockHistory: generateHistory(178.93, 0.42),
  },
  Rogers: {
    ticker: "RCI.B",
    companyName: "Rogers Communications Inc.",
    exchange: "TSX",
    mockPrice: 54.12,
    mockChange: -0.33,
    mockHistory: generateHistory(54.12, -0.33),
  },
  "Tim Hortons": {
    ticker: "QSR",
    companyName: "Restaurant Brands International",
    exchange: "NYSE",
    mockPrice: 71.85,
    mockChange: 0.91,
    mockHistory: generateHistory(71.85, 0.91),
  },
  DoorDash: {
    ticker: "DASH",
    companyName: "DoorDash Inc.",
    exchange: "NASDAQ",
    mockPrice: 172.63,
    mockChange: 2.08,
    mockHistory: generateHistory(172.63, 2.08),
  },
};

export function getStockInfo(merchantName: string): StockInfo | null {
  return STOCK_MAP[merchantName] ?? null;
}
