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
  Coffee,
  Bike,
  Cigarette,
  Wine,
  Smartphone,
  Wifi,
  Dumbbell,
  Shield,
  Heart,
  Scissors,
  Pill,
  Laptop,
  Plane,
  Sofa,
  Gift,
} from "lucide-react";
import type { TransactionCategory } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/constants";

const iconMap: Record<
  TransactionCategory,
  React.ComponentType<{ size?: number; strokeWidth?: number }>
> = {
  rent: Home,
  groceries: ShoppingCart,
  transit: Bus,
  subscriptions: Tv,
  income: DollarSign,
  transfer: ArrowRightLeft,
  coffee: Coffee,
  food_delivery: Bike,
  vaping: Cigarette,
  alcohol: Wine,
  impulse_shopping: ShoppingBag,
  dining_out: UtensilsCrossed,
  rideshare: Car,
  phone: Smartphone,
  internet: Wifi,
  gym: Dumbbell,
  insurance: Shield,
  health: Heart,
  personal_care: Scissors,
  pharmacy: Pill,
  electronics: Laptop,
  travel: Plane,
  fitness: Dumbbell,
  home: Sofa,
  gifts: Gift,
  other: MoreHorizontal,
};

interface CategoryIconProps {
  category: TransactionCategory;
  size?: number;
}

export function CategoryIcon({ category, size = 18 }: CategoryIconProps) {
  const Icon = iconMap[category] || MoreHorizontal;
  const color = CATEGORY_COLORS[category] || "#888888";

  return (
    <div
      className="flex items-center justify-center rounded-[8px] w-10 h-10 shrink-0"
      style={{ backgroundColor: `${color}14` }}
    >
      <Icon size={size} strokeWidth={1.75} />
    </div>
  );
}
