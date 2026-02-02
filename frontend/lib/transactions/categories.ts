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
