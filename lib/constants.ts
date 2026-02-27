import type { TransactionCategory } from "./types";

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  rent: "Rent",
  groceries: "Groceries",
  transit: "Transit",
  subscriptions: "Subscriptions",
  dining: "Dining Out",
  rideshare: "Rideshare",
  shopping: "Shopping",
  income: "Income",
  transfer: "Transfer",
  other: "Other",
};

export const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  rent: "#8B7355",
  groceries: "#4A7C59",
  transit: "#5B7FA5",
  subscriptions: "#7B68AE",
  dining: "#C4763C",
  rideshare: "#3D3D3D",
  shopping: "#A0522D",
  income: "#0B8A3E",
  transfer: "#687068",
  other: "#888888",
};

export const CHART_COLORS = {
  spending: "rgb(50, 48, 47)",
  investing: "#0B8A3E",
};
