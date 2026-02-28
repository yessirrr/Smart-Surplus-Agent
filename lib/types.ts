export interface Transaction {
  id: string;
  date: string;
  amount: number;
  merchant: string;
  category: TransactionCategory;
  type: "debit" | "credit";
  description: string;
}

export type TransactionCategory =
  | "rent"
  | "groceries"
  | "transit"
  | "subscriptions"
  | "income"
  | "transfer"
  | "coffee"
  | "food_delivery"
  | "vaping"
  | "alcohol"
  | "impulse_shopping"
  | "dining_out"
  | "rideshare"
  | "phone"
  | "internet"
  | "gym"
  | "insurance"
  | "health"
  | "personal_care"
  | "pharmacy"
  | "electronics"
  | "travel"
  | "fitness"
  | "home"
  | "gifts"
  | "other";

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  province: string;
  city: string;
  income: {
    gross_annual: number;
    net_biweekly: number;
    pay_schedule: string;
    pay_day: string;
    employer: string;
  };
  accounts: {
    chequing_balance: number;
    savings_balance: number;
    tfsa_balance: number;
    rrsp_balance: number;
  };
  risk_tolerance: "low" | "medium" | "high";
  investment_horizon: string;
  goals: string[];
  created_at: string;
}
