import stockSeriesData from "./stock-data.json";

export interface StockInfo {
  ticker: string;
  companyName: string;
  exchange: string;
}

export interface StockPricePoint {
  date: string;
  close: number;
}

export interface LocalStockData {
  ticker: string;
  prices: StockPricePoint[];
  latestClose: number;
  changePercent: number;
}

const STOCK_MAP: Record<string, StockInfo> = {
  Amazon: { ticker: "AMZN", companyName: "Amazon.com Inc.", exchange: "NASDAQ" },
  "Amazon.ca": { ticker: "AMZN", companyName: "Amazon.com Inc.", exchange: "NASDAQ" },
  Apple: { ticker: "AAPL", companyName: "Apple Inc.", exchange: "NASDAQ" },
  "Apple Store": { ticker: "AAPL", companyName: "Apple Inc.", exchange: "NASDAQ" },
  Starbucks: { ticker: "SBUX", companyName: "Starbucks Corporation", exchange: "NASDAQ" },
  "McDonald's": { ticker: "MCD", companyName: "McDonald's Corporation", exchange: "NYSE" },
  Netflix: { ticker: "NFLX", companyName: "Netflix Inc.", exchange: "NASDAQ" },
  Spotify: { ticker: "SPOT", companyName: "Spotify Technology S.A.", exchange: "NYSE" },
  Shopify: { ticker: "SHOP", companyName: "Shopify Inc.", exchange: "NYSE" },
  Uber: { ticker: "UBER", companyName: "Uber Technologies Inc.", exchange: "NYSE" },
  UberEats: { ticker: "UBER", companyName: "Uber Technologies Inc.", exchange: "NYSE" },
  Lyft: { ticker: "LYFT", companyName: "Lyft Inc.", exchange: "NASDAQ" },
  Airbnb: { ticker: "ABNB", companyName: "Airbnb Inc.", exchange: "NASDAQ" },
  "Best Buy": { ticker: "BBY", companyName: "Best Buy Co. Inc.", exchange: "NYSE" },
  Chipotle: { ticker: "CMG", companyName: "Chipotle Mexican Grill Inc.", exchange: "NYSE" },
  Loblaws: { ticker: "L.TO", companyName: "Loblaw Companies Limited", exchange: "TSX" },
  Rogers: { ticker: "RCI-B.TO", companyName: "Rogers Communications Inc.", exchange: "TSX" },
  "Tim Hortons": { ticker: "QSR", companyName: "Restaurant Brands International", exchange: "NYSE" },
  DoorDash: { ticker: "DASH", companyName: "DoorDash Inc.", exchange: "NASDAQ" },
};

const LOCAL_SERIES_BY_TICKER = stockSeriesData as Record<string, LocalStockData>;

export function getStockInfo(merchantName: string): StockInfo | null {
  return STOCK_MAP[merchantName] ?? null;
}

export function getLocalStockData(ticker: string): LocalStockData | null {
  return LOCAL_SERIES_BY_TICKER[ticker.toUpperCase()] ?? null;
}
