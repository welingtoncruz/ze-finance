"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft,
  Send,
  Sparkles,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Receipt,
  Lightbulb,
  Plus,
  Mic,
  MicOff,
} from "lucide-react"
import type { ChatMessage, Transaction, UserProfile } from "@/lib/types"
import { ThemeToggle } from "@/components/theme-toggle"

interface ZefaChatScreenProps {
  transactions: Transaction[]
  userProfile: UserProfile
}

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Olá! Sou o Zefa, seu assistente financeiro pessoal. 👋\n\n**Nota:** Esta é uma versão prévia. Algumas funcionalidades avançadas (como Insights detalhados e análises profundas) estarão disponíveis em breve.\n\nPor enquanto, posso te ajudar a:\n\n- Analisar seus gastos básicos\n- Adicionar transações\n- Responder dúvidas sobre suas finanças\n- Dar dicas personalizadas\n\nComo posso ajudar?",
  timestamp: new Date(),
}

const SUGGESTIONS = [
  { icon: TrendingUp, text: "Como estão meus gastos?", color: "text-primary" },
  { icon: PiggyBank, text: "Quanto economizei?", color: "text-success-foreground" },
  { icon: Receipt, text: "Adicionar despesa", color: "text-destructive" },
  { icon: Lightbulb, text: "Dicas para economizar", color: "text-accent-foreground" },
]

function generateAIResponse(
  userMessage: string,
  transactions: Transaction[],
  userProfile: UserProfile
): { content: string; action?: ChatMessage["action"] } {
  const message = userMessage.toLowerCase()
  
  // Calculate financial metrics
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0)
  const balance = totalIncome - totalExpenses
  const budgetRemaining = userProfile.monthlyBudget - totalExpenses
  const budgetPercent = Math.round((totalExpenses / userProfile.monthlyBudget) * 100)

  // Expense categories
  const expensesByCategory = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount
      return acc
    }, {} as Record<string, number>)
  
  const topCategory = Object.entries(expensesByCategory)
    .sort(([, a], [, b]) => b - a)[0]

  // Check for spending/gastos queries
  if (message.includes("gasto") || message.includes("despesa") || message.includes("spending")) {
    return {
      content: `Analisei suas finanças:\n\n**Este mês:**\n- Total de gastos: R$ ${totalExpenses.toFixed(2)}\n- Orçamento usado: ${budgetPercent}%\n- Restante: R$ ${budgetRemaining.toFixed(2)}\n\n**Maior categoria:** ${topCategory?.[0] || "N/A"} (R$ ${topCategory?.[1]?.toFixed(2) || "0"})\n\n${budgetPercent > 80 ? "Atenção! Você já usou mais de 80% do orçamento." : "Você está dentro do orçamento. Continue assim!"}`,
      action: { type: "show_insights" },
    }
  }

  // Check for savings/economizar queries
  if (message.includes("economiz") || message.includes("poupar") || message.includes("saving")) {
    const savingsProgress = Math.round((userProfile.totalSaved / userProfile.savingsGoal) * 100)
    return {
      content: `**Suas economias:**\n\n- Meta de economia: R$ ${userProfile.savingsGoal.toFixed(2)}\n- Já economizado: R$ ${userProfile.totalSaved.toFixed(2)}\n- Progresso: ${savingsProgress}%\n\n**Dica:** Se você economizar R$ ${((userProfile.savingsGoal - userProfile.totalSaved) / 12).toFixed(2)} por mês, alcançará sua meta em 1 ano!`,
    }
  }

  // Check for add transaction
  if (message.includes("adicionar") || message.includes("add") || message.includes("nova") || message.includes("registrar")) {
    if (message.includes("despesa") || message.includes("gasto") || message.includes("expense")) {
      return {
        content: "Vou abrir o formulário para você adicionar uma nova despesa. Basta preencher os detalhes!",
        action: { type: "add_transaction", data: { type: "expense" } },
      }
    }
    if (message.includes("receita") || message.includes("entrada") || message.includes("income") || message.includes("salário")) {
      return {
        content: "Vou abrir o formulário para você adicionar uma nova receita. Basta preencher os detalhes!",
        action: { type: "add_transaction", data: { type: "income" } },
      }
    }
    return {
      content: "Vou abrir o formulário para você adicionar uma nova transação. O que deseja registrar?",
      action: { type: "add_transaction" },
    }
  }

  // Check for tips/dicas
  if (message.includes("dica") || message.includes("tip") || message.includes("conselho") || message.includes("sugest")) {
    const tips = [
      topCategory 
        ? `Sua maior despesa é com ${topCategory[0]}. Considere definir um limite mensal para essa categoria.`
        : "Comece registrando todas suas despesas para ter uma visão clara dos seus gastos.",
      budgetPercent > 70 
        ? "Você está usando mais de 70% do orçamento. Tente reduzir gastos não essenciais."
        : "Bom trabalho controlando os gastos! Que tal aumentar sua meta de economia?",
      "A regra 50/30/20: 50% para necessidades, 30% para desejos, 20% para economias.",
      "Revise suas assinaturas mensais - muitas vezes pagamos por serviços que não usamos.",
    ]
    return {
      content: `**Dicas personalizadas para você:**\n\n1. ${tips[0]}\n\n2. ${tips[1]}\n\n3. ${tips[2]}`,
    }
  }

  // Check for history
  if (message.includes("histórico") || message.includes("transaç") || message.includes("history")) {
    return {
      content: `Você tem ${transactions.length} transações registradas.\n\n- ${transactions.filter(t => t.type === "income").length} receitas\n- ${transactions.filter(t => t.type === "expense").length} despesas\n\nQuer ver o histórico completo?`,
      action: { type: "show_history" },
    }
  }

  // Default response
  return {
    content: `Entendi! Deixa eu te ajudar com isso.\n\n**Resumo rápido:**\n- Saldo atual: R$ ${balance.toFixed(2)}\n- Orçamento restante: R$ ${budgetRemaining.toFixed(2)}\n\nPosso te ajudar a analisar gastos, adicionar transações ou dar dicas de economia. O que prefere?`,
  }
}

export function ZefaChatScreen({
  transactions,
  userProfile,
}: ZefaChatScreenProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsTyping(true)

    // Simulate AI thinking time
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000))

    const response = generateAIResponse(text, transactions, userProfile)

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: response.content,
      timestamp: new Date(),
      action: response.action,
    }

    setMessages((prev) => [...prev, assistantMessage])
    setIsTyping(false)

    // Handle actions after a short delay
    if (response.action) {
      setTimeout(() => {
        if (response.action?.type === "add_transaction") {
          router.push("/transactions?add=true")
        } else if (response.action?.type === "show_history") {
          router.push("/transactions")
        } else if (response.action?.type === "show_insights") {
          router.push("/insights")
        }
      }, 1500)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSendMessage(inputValue)
  }

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion)
  }

  const toggleVoiceInput = () => {
    setIsListening(!isListening)
    // Voice recognition would be implemented here
  }

  const formatMessageContent = (content: string) => {
    // Simple markdown-like formatting
    return content
      .split("\n")
      .map((line, i) => {
        if (line.startsWith("**") && line.endsWith("**")) {
          return (
            <p key={i} className="font-semibold text-foreground">
              {line.slice(2, -2)}
            </p>
          )
        }
        if (line.startsWith("- ")) {
          return (
            <p key={i} className="ml-2 text-muted-foreground">
              {line}
            </p>
          )
        }
        if (line.match(/^\d+\./)) {
          return (
            <p key={i} className="ml-2 text-muted-foreground">
              {line}
            </p>
          )
        }
        return line ? (
          <p key={i}>{line}</p>
        ) : (
          <div key={i} className="h-2" />
        )
      })
  }

  return (
    <div className="flex h-full flex-col bg-background theme-transition">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-xl px-4 py-4 safe-area-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="rounded-xl p-2.5 transition-all hover:bg-muted active:scale-95"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success ring-2 ring-card" />
              </div>
              <div>
                <h1 className="text-base font-bold text-foreground">Zefa</h1>
                <p className="text-xs text-success-foreground">Online</p>
              </div>
            </div>
          </div>
          <ThemeToggle variant="standalone" />
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                }`}
              >
                <div className="text-sm leading-relaxed space-y-1">
                  {formatMessageContent(message.content)}
                </div>
                {message.action && (
                  <div className="mt-3 pt-2 border-t border-current/10">
                    <button
                      onClick={() => {
                        if (message.action?.type === "add_transaction") {
                          router.push("/transactions?add=true")
                        } else if (message.action?.type === "show_history") {
                          router.push("/transactions")
                        } else if (message.action?.type === "show_insights") {
                          router.push("/insights")
                        }
                      }}
                      className="text-xs font-medium underline underline-offset-2 opacity-80 hover:opacity-100"
                    >
                      {message.action.type === "add_transaction" && "Abrir formulário"}
                      {message.action.type === "show_history" && "Ver transações"}
                      {message.action.type === "show_insights" && "Ver insights"}
                    </button>
                  </div>
                )}
                <p className={`mt-1 text-[10px] ${message.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="chat-message flex justify-start">
              <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                <div className="flex items-center gap-1">
                  <div className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/50" />
                  <div className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/50" />
                  <div className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/50" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggestions */}
      {messages.length <= 2 && (
        <div className="border-t border-border bg-card/50 px-4 py-3">
          <div className="mx-auto max-w-2xl">
            <p className="mb-2 text-xs text-muted-foreground">Sugestões:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.text}
                  onClick={() => handleSuggestionClick(suggestion.text)}
                  className="suggestion-chip flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm font-medium text-foreground"
                >
                  <suggestion.icon className={`h-4 w-4 ${suggestion.color}`} />
                  {suggestion.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="chat-input-container px-4 py-3 safe-area-bottom">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/transactions?add=true")}
              className="rounded-full bg-primary/10 p-3 text-primary transition-all hover:bg-primary/20 active:scale-95"
              aria-label="Adicionar transação"
            >
              <Plus className="h-5 w-5" />
            </button>
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="chat-input h-12 rounded-full border-border/50 bg-muted/50 pr-12 pl-4 transition-all focus:bg-background"
              />
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 transition-all ${
                  isListening
                    ? "bg-destructive text-destructive-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label={isListening ? "Parar gravação" : "Gravar voz"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            </div>
            <Button
              type="submit"
              disabled={!inputValue.trim()}
              className="h-12 w-12 rounded-full p-0 shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
