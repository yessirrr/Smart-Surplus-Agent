import type { Transaction } from "@/lib/types";
import { CategoryIcon } from "./CategoryIcon";
import { StockLogoWithPopover } from "./market/StockLogoWithPopover";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getStockInfo } from "@/lib/market/stocks";

interface TransactionRowProps {
  transaction: Transaction;
}

export function TransactionRow({ transaction }: TransactionRowProps) {
  const isIncome = transaction.type === "credit";
  const hasStock = getStockInfo(transaction.merchant) !== null;

  return (
    <div className="flex items-center gap-3 py-3">
      {hasStock ? (
        <StockLogoWithPopover merchant={transaction.merchant} size={40} />
      ) : (
        <CategoryIcon category={transaction.category} />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-ws-charcoal truncate">
          {transaction.description}
        </p>
        <p className="text-xs text-ws-grey">
          {formatDate(transaction.date)}
        </p>
      </div>
      <p
        className={`text-sm font-bold tabular-nums whitespace-nowrap ${
          isIncome ? "text-ws-green" : "text-ws-charcoal"
        }`}
      >
        {isIncome ? "+" : "-"}
        {formatCurrency(transaction.amount)}
      </p>
    </div>
  );
}
