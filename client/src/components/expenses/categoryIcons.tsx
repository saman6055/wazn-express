import type { ReactNode } from "react";
import {
  Building2,
  Users,
  Zap,
  Truck,
  Phone,
  Wrench,
  Receipt,
  Fuel,
  Car,
  Plane,
  Ship,
  Package,
  Utensils,
  Coffee,
  ShoppingCart,
  Droplets,
  Flame,
  Wifi,
  Printer,
  Laptop,
  Megaphone,
  Landmark,
  Scale,
  Gift,
  Stethoscope,
  Hammer,
  Warehouse,
  Shield,
  BookOpen,
  CreditCard,
} from "lucide-react";

/**
 * The icons a category can carry.
 *
 * One list, used by the picker and by every place a category is drawn. It
 * used to be seven emoji in a dropdown, which meant a freight company had a
 * choice of "building" or "other" for customs, fuel, meals and flights — and
 * every category ended up wearing the same receipt.
 *
 * Keys are stored in the database, so they are renamed only with a migration.
 * Adding one is free; removing one leaves existing categories pointing at
 * nothing, which is why the fallback below exists.
 */
export const CATEGORY_ICON_KEYS = [
  "receipt",
  "building",
  "warehouse",
  "users",
  "truck",
  "car",
  "fuel",
  "plane",
  "ship",
  "package",
  "utensils",
  "coffee",
  "cart",
  "zap",
  "droplets",
  "flame",
  "wifi",
  "phone",
  "printer",
  "laptop",
  "wrench",
  "hammer",
  "megaphone",
  "landmark",
  "scale",
  "shield",
  "book",
  "card",
  "gift",
  "health",
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

const ICONS: Record<string, (className: string) => ReactNode> = {
  receipt: (c) => <Receipt className={c} />,
  building: (c) => <Building2 className={c} />,
  warehouse: (c) => <Warehouse className={c} />,
  users: (c) => <Users className={c} />,
  truck: (c) => <Truck className={c} />,
  car: (c) => <Car className={c} />,
  fuel: (c) => <Fuel className={c} />,
  plane: (c) => <Plane className={c} />,
  ship: (c) => <Ship className={c} />,
  package: (c) => <Package className={c} />,
  utensils: (c) => <Utensils className={c} />,
  coffee: (c) => <Coffee className={c} />,
  cart: (c) => <ShoppingCart className={c} />,
  zap: (c) => <Zap className={c} />,
  droplets: (c) => <Droplets className={c} />,
  flame: (c) => <Flame className={c} />,
  wifi: (c) => <Wifi className={c} />,
  phone: (c) => <Phone className={c} />,
  printer: (c) => <Printer className={c} />,
  laptop: (c) => <Laptop className={c} />,
  wrench: (c) => <Wrench className={c} />,
  hammer: (c) => <Hammer className={c} />,
  megaphone: (c) => <Megaphone className={c} />,
  landmark: (c) => <Landmark className={c} />,
  scale: (c) => <Scale className={c} />,
  shield: (c) => <Shield className={c} />,
  book: (c) => <BookOpen className={c} />,
  card: (c) => <CreditCard className={c} />,
  gift: (c) => <Gift className={c} />,
  health: (c) => <Stethoscope className={c} />,
};

/**
 * Draw a category's icon. An unknown key — a category made before an icon
 * was removed, or one written by hand — falls back to a receipt rather than
 * leaving a hole in the layout.
 */
export function categoryIcon(key: string | null | undefined, className = "h-4 w-4"): ReactNode {
  return (ICONS[key ?? ""] ?? ICONS.receipt!)(className);
}
