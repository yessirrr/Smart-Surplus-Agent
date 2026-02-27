export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: TransactionCategory;
  type: "expense" | "income";
}

export type TransactionCategory =
  | "rent"
  | "groceries"
  | "transit"
  | "subscriptions"
  | "dining"
  | "rideshare"
  | "shopping"
  | "income"
  | "transfer"
  | "other";

export interface UserProfile {
  name: string;
  firstName: string;
  age: number;
  monthlyIncome: number;
  riskTolerance: "low" | "medium" | "high";
  investmentGoal: string;
  currentHoldings: {
    tfsa: number;
    crypto: number;
    cashBalance: number;
  };
}
