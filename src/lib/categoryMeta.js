// One icon + tint per expense category, used everywhere a category shows up
// so expenses become scannable at a glance (a pattern every major
// split-expense app converged on: icon chips beat plain text labels).
import {
  CircleEllipsis, Clapperboard, HeartPulse, Home, Lightbulb,
  Car, ShoppingBag, Tv, UtensilsCrossed,
} from 'lucide-react'

const META = {
  'Food & Groceries': { Icon: UtensilsCrossed, tint: '#B4552D' },
  Rent: { Icon: Home, tint: '#2E5E4E' },
  Utilities: { Icon: Lightbulb, tint: '#946B2D' },
  Transportation: { Icon: Car, tint: '#3E5C76' },
  Entertainment: { Icon: Clapperboard, tint: '#7A4E7E' },
  Shopping: { Icon: ShoppingBag, tint: '#8C3B4A' },
  Health: { Icon: HeartPulse, tint: '#2D6E6E' },
  Subscriptions: { Icon: Tv, tint: '#4E6E33' },
  Other: { Icon: CircleEllipsis, tint: '#6B7280' },
}

export function categoryMeta(category) {
  return META[category] || META.Other
}
