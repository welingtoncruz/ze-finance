"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { UserProfile } from "@/lib/types"

interface UserSettingsFormProps {
  initialProfile: UserProfile | null
  onProfileUpdated: (profile: UserProfile) => void
  onCancel?: () => void
}

export function UserSettingsForm({
  initialProfile,
  onProfileUpdated,
  onCancel,
}: UserSettingsFormProps) {
  const [name, setName] = useState(initialProfile?.name ?? "")
  const [monthlyBudget, setMonthlyBudget] = useState<string>(
    initialProfile ? String(initialProfile.monthlyBudget) : ""
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    const parsedBudget = Number(monthlyBudget)
    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      setError("Informe um orçamento mensal válido maior que zero.")
      return
    }

    try {
      setIsSaving(true)

      const updatedProfile: UserProfile = {
        name: name.trim() || "User",
        monthlyBudget: parsedBudget,
        savingsGoal: initialProfile?.savingsGoal ?? 10000,
        streak: 0,
        totalSaved: initialProfile?.totalSaved ?? 0,
      }

      onProfileUpdated(updatedProfile)
      setSuccess(true)
    } catch (err) {
      console.error("Failed to save profile:", err)
      setError("Não foi possível salvar suas configurações. Tente novamente.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="glass-card border-0 max-w-xl mx-auto">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl font-semibold">
          Configurações de perfil
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Como você quer ser chamado"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Esse nome será exibido no dashboard e nas telas principais.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthlyBudget">Orçamento mensal padrão</Label>
            <Input
              id="monthlyBudget"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="Ex: 5000"
              value={monthlyBudget}
              onChange={(event) => setMonthlyBudget(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Esse valor representa o orçamento atual que você quer usar como referência
              mensal (não é um histórico por mês).
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">
              {error}
            </p>
          )}
          {success && !error && (
            <p className="text-sm text-emerald-500">
              Configurações salvas com sucesso.
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={isSaving}
              >
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

