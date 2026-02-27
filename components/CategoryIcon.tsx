import {
  Home,
  ShoppingCart,
  Bus,
  Tv,
  UtensilsCrossed,
  Car,
  ShoppingBag,
  DollarSign,
  ArrowRightLeft,
  MoreHorizontal,
} from "lucide-react";
import type { TransactionCategory } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/constants";

const iconMap: Record<TransactionCategory, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  rent: Home,
  groceries: ShoppingCart,
  transit: Bus,
  subscriptions: Tv,
  dining: UtensilsCrossed,
  rideshare: Car,
  shopping: ShoppingBag,
  income: DollarSign,
  transfer: ArrowRightLeft,
  other: MoreHorizontal,
};

interface CategoryIconProps {
  category: TransactionCategory;
  size?: number;
}

export function CategoryIcon({ category, size = 18 }: CategoryIconProps) {
  const Icon = iconMap[category] || MoreHorizontal;
  const color = CATEGORY_COLORS[category];

  return (
    <div
      className="flex items-center justify-center rounded-[8px] w-10 h-10 shrink-0"
      style={{ backgroundColor: `${color}14` }}
    >
      <Icon size={size} strokeWidth={1.75} />
    </div>
  );
}
