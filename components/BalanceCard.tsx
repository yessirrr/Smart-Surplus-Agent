import { formatCurrency } from "@/lib/utils";

interface BalanceCardProps {
  balance: number;
  label?: string;
}

export function BalanceCard({ balance, label = "Total Balance" }: BalanceCardProps) {
  return (
    <div className="py-6">
      <p className="text-sm text-ws-grey mb-1">{label}</p>
      <p className="text-4xl font-bold text-ws-charcoal tracking-tight">
        {formatCurrency(balance)}
      </p>
    </div>
  );
}
