"use client"

import { cn } from "@/lib/utils"
import { getCategoriesByType, resolveCategoryValue, type CategoryDefinition } from "@/lib/transactions/categories"
import { CircleDot } from "lucide-react"
import type { TransactionType } from "@/lib/types"

interface CategoryPickerProps {
  value: string
  onChange: (value: string) => void
  type: TransactionType
  variant?: "compact" | "regular"
}

export function CategoryPicker({
  value,
  onChange,
  type,
  variant = "regular",
}: CategoryPickerProps) {
  const categories = getCategoriesByType(type)
  const resolvedValue = resolveCategoryValue(value)
  
  // Check if current value is a custom category (not found in predefined list for this type)
  // Use resolved value for matching if available, otherwise use raw value
  const valueToMatch = resolvedValue || value
  const isCustomCategory = value && !categories.some((cat) => cat.value === valueToMatch)
  
  // Create custom category option if needed
  const customCategory: CategoryDefinition | null = isCustomCategory
    ? {
        value: value, // Keep original value, not resolved
        label: value,
        icon: CircleDot,
        type: [type],
      }
    : null

  const isCompact = variant === "compact"
  const gridCols = isCompact ? "grid-cols-4" : "grid-cols-3 sm:grid-cols-4"

  // Combine custom category (if exists) with predefined categories
  const allCategories = customCategory ? [customCategory, ...categories] : categories

  return (
    <div className={cn("grid gap-2", gridCols)}>
      {allCategories.map((category) => {
        const Icon = category.icon
        // Match: use resolved value for predefined categories, exact value for custom
        const isSelected = customCategory && category.value === value
          ? true // Custom category selected
          : (resolvedValue ? resolvedValue === category.value : value === category.value)

        return (
          <button
            key={category.value}
            type="button"
            onClick={() => onChange(category.value)}
            className={cn(
              "group flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 transition-all touch-target",
              isSelected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-muted/50",
              isCompact ? "p-2 gap-1" : "p-3 gap-1.5"
            )}
            aria-label={category.label}
            aria-pressed={isSelected}
            data-testid={`tx-category-${category.value}`}
          >
            <Icon
              className={cn(
                "transition-all",
                isSelected ? "h-5 w-5 sm:h-6 sm:w-6" : "h-4 w-4 sm:h-5 sm:w-5",
                isCompact && "h-4 w-4"
              )}
              strokeWidth={isSelected ? 2.5 : 2}
            />
            <span
              className={cn(
                "text-center font-medium leading-tight transition-colors",
                isSelected ? "text-primary text-xs" : "text-muted-foreground text-[10px] sm:text-xs",
                isCompact && "text-[10px]"
              )}
            >
              {category.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
