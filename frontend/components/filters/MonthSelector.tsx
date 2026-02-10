"use client"

import type React from "react"

interface MonthSelectorProps {
  selectedMonth: string
  onChange: (value: string) => void
  monthsBack?: number
}

export function MonthSelector({
  selectedMonth,
  onChange,
  monthsBack = 6,
}: MonthSelectorProps) {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value)
  }

  const now = new Date()
  const options: string[] = []

  for (let i = 0; i < monthsBack; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push(date.toISOString().slice(0, 7))
  }

  return (
    <select
      value={selectedMonth}
      onChange={handleChange}
      className="h-9 rounded-lg border border-border bg-background px-3 text-xs sm:text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      {options.map((value) => {
        const [year, month] = value.split("-")
        const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("pt-BR", {
          month: "short",
          year: "numeric",
        })
        return (
          <option key={value} value={value}>
            {label}
          </option>
        )
      })}
    </select>
  )
}

