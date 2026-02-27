import type { Transaction } from "@/lib/types";
import { TransactionRow } from "./TransactionRow";

interface TransactionListProps {
  transactions: Transaction[];
}

export function TransactionList({ transactions }: TransactionListProps) {
  return (
    <div className="bg-ws-white rounded-[8px] border border-ws-border">
      <div className="divide-y divide-ws-border">
        {transactions.map((txn) => (
          <div key={txn.id} className="px-4">
            <TransactionRow transaction={txn} />
          </div>
        ))}
      </div>
    </div>
  );
}
