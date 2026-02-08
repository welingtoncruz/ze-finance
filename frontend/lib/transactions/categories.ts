import {
  Wallet,
  Laptop,
  ShoppingCart,
  Car,
  Film,
  Home,
  Zap,
  Heart,
  ShoppingBag,
  CircleDot,
  type LucideIcon,
} from "lucide-react"
import type { TransactionType } from "@/lib/types"

export interface CategoryDefinition {
  value: string
  label: string
  icon: LucideIcon
  type: TransactionType[]
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    value: "Salary",
    label: "Salário",
    icon: Wallet,
    type: ["income"],
  },
  {
    value: "Freelance",
    label: "Freelance",
    icon: Laptop,
    type: ["income"],
  },
  {
    value: "Groceries",
    label: "Alimentação",
    icon: ShoppingCart,
    type: ["expense"],
  },
  {
    value: "Transport",
    label: "Transporte",
    icon: Car,
    type: ["expense"],
  },
  {
    value: "Entertainment",
    label: "Entretenimento",
    icon: Film,
    type: ["expense"],
  },
  {
    value: "Rent",
    label: "Aluguel",
    icon: Home,
    type: ["expense"],
  },
  {
    value: "Utilities",
    label: "Utilidades",
    icon: Zap,
    type: ["expense"],
  },
  {
    value: "Health",
    label: "Saúde",
    icon: Heart,
    type: ["expense"],
  },
  {
    value: "Shopping",
    label: "Compras",
    icon: ShoppingBag,
    type: ["expense"],
  },
  {
    value: "Other",
    label: "Outros",
    icon: CircleDot,
    type: ["income", "expense"],
  },
]

/**
 * Get category label by value
 */
export function getCategoryLabel(value: string): string {
  const category = CATEGORIES.find((cat) => cat.value === value)
  return category?.label || value
}

/**
 * Get categories filtered by transaction type
 */
export function getCategoriesByType(type: TransactionType): CategoryDefinition[] {
  return CATEGORIES.filter((cat) => cat.type.includes(type))
}

/**
 * Get category definition by value
 */
export function getCategoryByValue(value: string): CategoryDefinition | undefined {
  return CATEGORIES.find((cat) => cat.value === value)
}

/**
 * Resolve a category value or label to its canonical value.
 * Handles case-insensitive matching for both values and labels.
 * Returns null if no match is found (custom/unknown category).
 */
export function resolveCategoryValue(valueOrLabel: string): string | null {
  if (!valueOrLabel) return null
  
  const normalized = valueOrLabel.trim()
  if (!normalized) return null
  
  // Try exact match first (case-sensitive)
  const exactMatch = CATEGORIES.find((cat) => cat.value === normalized)
  if (exactMatch) return exactMatch.value
  
  // Try case-insensitive value match
  const valueMatch = CATEGORIES.find(
    (cat) => cat.value.toLowerCase() === normalized.toLowerCase()
  )
  if (valueMatch) return valueMatch.value
  
  // Try case-insensitive label match
  const labelMatch = CATEGORIES.find(
    (cat) => cat.label.toLowerCase() === normalized.toLowerCase()
  )
  if (labelMatch) return labelMatch.value
  
  // No match found - custom category
  return null
}

/**
 * Check if a category value is a predefined category (exists in CATEGORIES)
 */
export function isPredefinedCategory(value: string): boolean {
  return CATEGORIES.some((cat) => cat.value === value)
}
