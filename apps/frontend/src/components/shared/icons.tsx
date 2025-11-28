import {
  Bed,
  Building,
  Building2,
  Coffee,
  CreditCard,
  Hotel,
  Loader2,
  LucideProps,
  Package,
  PackageCheck,
  ShirtIcon,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Store,
  Truck,
  UtensilsCrossed,
} from "lucide-react"

export type Icon = LucideProps

export const Icons = {
  logo: ShoppingCart,
  spinner: Loader2,
  store: Store,
  building: Building2,
  buildings: Building,
  hotel: Hotel,
  bed: Bed,
  bag: ShoppingBag,
  basket: ShoppingBasket,
  package: Package,
  packageCheck: PackageCheck,
  truck: Truck,
  creditCard: CreditCard,
  clothes: ShirtIcon,
  coffee: Coffee,
  restaurant: UtensilsCrossed,
}

export type IconKeys = keyof typeof Icons
