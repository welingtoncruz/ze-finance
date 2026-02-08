# Frontend Implementation Plan: Equalize UI Language (pt-BR)

## 1. Analysis & Design

* **Goal**: Standardize all user-facing UI text to **Portuguese (pt-BR)** across the app. The project rule states: *"User-facing UI text should be in Portuguese (pt-BR)."* Currently, auth, dashboard, transactions, insights, and navigation mix English and Portuguese.
* **Scope**: Frontend only. No API or backend message changes in this ticket. No full i18n framework—replace inline strings with pt-BR equivalents.
* **Route**: Multiple routes and components (no single page).
* **Responsive Layout**: No layout changes; only copy/strings.
* **Server vs Client**: All affected components are already Client Components where the strings live; no change to `'use client'` usage.

---

## 2. Component Architecture

* **No new components.** Changes are string replacements in existing components.
* **Optional (YAGNI for MVP)**: A small `frontend/lib/strings.ts` or `frontend/lib/i18n.ts` with constants (e.g. `UI_STRINGS`) could centralize copy for future i18n. For this ticket, **inline replacement** is acceptable to avoid over-engineering.
* **ShadcnUI Primitives**: No new usage; existing Button, Card, Input, etc. unchanged.
* **Icons**: No new icons.

---

## 3. Inventory of User-Facing Strings (EN → pt-BR)

### 3.1 Auth

| Location | Current (EN) | Target (pt-BR) |
|----------|----------------|----------------|
| `AuthForm.tsx` | "Welcome back" | "Bem-vindo de volta" |
| | "Create account" | "Criar conta" |
| | "Enter your credentials to continue" | "Digite suas credenciais para continuar" |
| | "Sign up to get started" | "Cadastre-se para começar" |
| | "you@example.com" | "seu@email.com" |
| | "Enter your password" | "Digite sua senha" |
| | "At least 8 characters" | "Mínimo de 8 caracteres" |
| | "Signing in..." | "Entrando..." |
| | "Creating account..." | "Criando conta..." |
| | "Sign In" | "Entrar" |
| | "Sign Up" | "Cadastrar" |
| `app/login/page.tsx` | "Invalid email or password. Please try again." | "E-mail ou senha inválidos. Tente novamente." |
| | "Smart Analytics" | "Análises inteligentes" |
| | "AI-powered insights into your spending" | "Insights com IA sobre seus gastos" |
| | "Bank-grade Security" | "Segurança de nível bancário" |
| | "Your data is encrypted and protected" | "Seus dados são criptografados e protegidos" |
| | "Real-time Sync" | "Sincronização em tempo real" |
| | "Instant updates across all devices" | "Atualizações instantâneas em todos os dispositivos" |
| `app/register/page.tsx` | "Registration failed. Please try again." | "Falha no cadastro. Tente novamente." |

### 3.2 Navigation & Layout

| Location | Current (EN) | Target (pt-BR) |
|----------|----------------|----------------|
| `DesktopSidebar.tsx` | "Dashboard" | "Início" (align with BottomNav) |
| | "Insights" | "Insights" (keep as proper noun) or "Análises" |
| | "Zefa", "Transações" | Already pt-BR |
| | "{n} day streak" | "{n} dias de sequência" |
| `DashboardScreen.tsx` | "Welcome back," | "Bem-vindo de volta," |
| | "{n} day streak" | "{n} dias de sequência" |
| `theme-toggle.tsx` | "Switch to ${light/dark} mode" | "Mudar para modo claro/escuro" |
| `MobileAccountDrawer.tsx` | "Conta" | Already pt-BR |
| `BottomNavigation.tsx` | "Início", "Insights", "Zefa", "Transações", "Conta" | Already pt-BR |

### 3.3 Transactions

| Location | Current (EN) | Target (pt-BR) |
|----------|----------------|----------------|
| `app/transactions/page.tsx` | "Transaction deleted" | "Transação excluída" |
| | "Failed to delete transaction" | "Falha ao excluir transação" |
| | "Failed to load transactions" | "Falha ao carregar transações" |
| | "Transaction added successfully" | "Transação adicionada com sucesso" |
| | "Failed to add transaction" | "Falha ao adicionar transação" |
| `TransactionsScreen.tsx` | "No transactions found" | "Nenhuma transação encontrada" |
| | "Add your first transaction to get started" | "Adicione sua primeira transação para começar" |
| | aria-label "Add transaction" (header + FAB) | "Adicionar transação" |
| `TransactionForm.tsx` | "Cancelar", "Salvar", "Adicionar", "Salvando...", "Adicionando..." | Already pt-BR |
| | "Valor", "Data", "Descrição (opcional)", "Adicione uma nota..." | Already pt-BR |
| | "Despesa", "Receita" | Already pt-BR |
| `EditTransactionDrawer.tsx` | "Editar Transação" | Already pt-BR |
| Drawer title "Nova Transação" (transactions/page) | Already pt-BR | — |

### 3.4 Dashboard & Empty States

| Location | Current (EN) | Target (pt-BR) |
|----------|----------------|----------------|
| `DashboardScreen.tsx` | "No transactions yet" | "Nenhuma transação ainda" |
| | "Tap the + button to add your first transaction" | "Toque no + para adicionar sua primeira transação" |
| `EmptyState.tsx` | Receives title/description from parents | No change; callers pass pt-BR |

### 3.5 Insights

| Location | Current (EN) | Target (pt-BR) |
|----------|----------------|----------------|
| `InsightsCard.tsx` | "Getting Started" | "Começando" |
| | "Add some transactions to see personalized insights!" | "Adicione transações para ver insights personalizados!" |
| | "Budget Alert" | "Alerta de orçamento" |
| | "You've used X% of your monthly budget. Consider reducing expenses." | "Você usou X% do seu orçamento mensal. Considere reduzir gastos." |
| | "Heads Up" | "Atenção" |
| | "X% of budget used. R$Y remaining this month." | "X% do orçamento usado. R$ Y restantes este mês." |
| | "Spending Pattern" | "Padrão de gastos" |
| | "Your top expense category is X at R$Y this month." | "Sua maior categoria de gastos é X com R$ Y este mês." |
| | "Great Progress!" | "Ótimo progresso!" |
| | "You have R$X remaining. Consider adding to your savings!" | "Você tem R$ X restantes. Considere aumentar suas economias!" |
| `InsightsScreen.tsx` | "restantes", "Parabéns! Você alcançou sua meta!", "Gastos por Categoria" | Already pt-BR |
| | "Receita", "Despesas" | Already pt-BR |

### 3.6 Chat

| Location | Current (EN) | Target (pt-BR) |
|----------|----------------|----------------|
| `ZefaChatScreen.tsx` | "Voltar", "Buscar mensagens", "Digite sua mensagem...", "Adicionar transação", "Enviar mensagem" | Already pt-BR |
| | "Sugestões:", "Transação criada com sucesso!" | Already pt-BR |
| `ChatSearchBar.tsx` | "Buscar mensagens...", "Limpar busca", "Resultado anterior", "Próximo resultado", "Fechar busca" | Already pt-BR |
| `ChatBubble.tsx` | "Erro ao enviar", "Tentar novamente", "Enviando..." | Already pt-BR |
| `useChat.ts` | User-facing error messages | Already pt-BR |
| `TypingIndicator.tsx` | "Zefa está digitando..." | Already pt-BR |
| `ComingSoonBanner.tsx` | "Em breve", default message | Already pt-BR |

---

## 4. State & Data Fetching

* **No API changes.** All replacements are static copy in JSX/TS.
* **No new state or context.** Error messages from API can remain in English in logs; only **toast** and **UI labels** must be pt-BR.
* **AuthContext**: No change; error messages set in login/register pages are updated in step 1.

---

## 5. Implementation Steps

1. **Auth flow (AuthForm + login + register pages)**  
   Replace all EN strings in `AuthForm.tsx`, `app/login/page.tsx`, and `app/register/page.tsx` with the pt-BR values from the tables above. Ensure login/register `setError(...)` messages are pt-BR.

2. **Navigation and layout**  
   In `DesktopSidebar.tsx`: translate "Dashboard" → "Início", optionally "Insights" → "Análises", and "{n} day streak" → "{n} dias de sequência".  
   In `DashboardScreen.tsx`: "Welcome back," → "Bem-vindo de volta,", "{n} day streak" → "{n} dias de sequência".  
   In `theme-toggle.tsx`: `aria-label` to "Mudar para modo claro" / "Mudar para modo escuro".

3. **Transactions**  
   In `app/transactions/page.tsx`: replace all `toast.success` / `toast.error` / `toast.warning` messages with pt-BR.  
   In `TransactionsScreen.tsx`: replace EmptyState `title`/`description` and both `aria-label="Add transaction"` with pt-BR.

4. **Dashboard empty state**  
   In `DashboardScreen.tsx`: replace EmptyState `title` and `description` with pt-BR.

5. **Insights**  
   In `InsightsCard.tsx`: replace all `insight.title` and `insight.message` strings (including template literals with `R$` and `%`) with pt-BR. Keep dynamic parts (e.g. `Math.round(budgetUsed)`, `remaining`, `topCategory[0]`, `topCategory[1]`) in code; only the surrounding text is translated.

6. **Smoke check and tests**  
   Run the app; verify login, register, dashboard, transactions list, empty states, insights cards, chat, and theme toggle.  
   Update **frontend tests** that assert on user-facing text: replace EN expectations with pt-BR (e.g. `getByText("Welcome back")` → `getByText("Bem-vindo de volta")`, toast messages, aria-labels). Focus on: `AuthForm` (if tested), `transaction-form.test.tsx`, `transactions-page-add-flow.test.tsx`, `chat-integration.test.tsx`, and any test that checks for "No transactions found", "Add transaction", etc.

7. **Documentation**  
   Optionally add a short note in `PROJECT_DOCUMENTATION.md` or frontend README that the UI language is pt-BR and that new copy must be added in Portuguese.

---

## 6. Validation Checklist

- [ ] All user-facing strings in the listed files are in pt-BR (labels, placeholders, buttons, toasts, empty states, insights, auth, nav).
- [ ] `aria-label` and `placeholder` attributes are pt-BR for accessibility.
- [ ] No new `any` types; no removal of existing types.
- [ ] Tests that assert on UI text are updated to pt-BR and still pass.
- [ ] Layout and behavior unchanged; only copy changed.
- [ ] Uses existing `api` and patterns; no new dependencies.

---

## 7. Files to Touch (Summary)

| File | Action |
|------|--------|
| `frontend/components/auth/AuthForm.tsx` | Replace EN strings with pt-BR |
| `frontend/app/login/page.tsx` | Replace error message and feature titles/descriptions |
| `frontend/app/register/page.tsx` | Replace error message |
| `frontend/components/layout/DesktopSidebar.tsx` | Nav labels + streak text |
| `frontend/components/dashboard/DashboardScreen.tsx` | Welcome back, streak, empty state |
| `frontend/components/theme-toggle.tsx` | aria-label |
| `frontend/app/transactions/page.tsx` | Toast messages |
| `frontend/components/transactions/TransactionsScreen.tsx` | EmptyState + aria-labels |
| `frontend/components/dashboard/InsightsCard.tsx` | All insight titles and messages |
| `frontend/tests/**` | Update assertions that depend on EN UI text |

---

## 8. Out of Scope (Future)

* Backend error messages or API response text.
* Full i18n (e.g. react-i18next) and language switcher.
* E2E tests: update in same PR if they assert on EN strings; otherwise follow-up.
