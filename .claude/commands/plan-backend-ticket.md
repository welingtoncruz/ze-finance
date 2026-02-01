openapi: 3.0.0
info:
  title: Zefa Finance API
  description: >
    API do Zefa Finance (MVP).
    Utiliza autenticação via JWT (OAuth2 Password Bearer).
    O fluxo é: 1. Registrar -> 2. Obter Token (Login) -> 3. Acessar Rotas Protegidas enviando o Token no Header.
  version: 0.2.0
  contact:
    name: Zefa Arch Team

servers:
  - url: http://localhost:8000
    description: Servidor Local (Docker)

# --- DEFINIÇÃO DE SEGURANÇA GLOBAL ---
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - bearerAuth: [] # Aplica segurança globalmente (exceto onde sobrescrito)

paths:
  # --- ROTAS PÚBLICAS (AUTH) ---
  /auth/register:
    post:
      summary: Registrar novo usuário
      description: Cria uma nova conta de usuário com email e senha.
      operationId: register_user
      security: [] # Rota pública
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserCreate'
      responses:
        '201':
          description: Usuário criado com sucesso. Retorna o token de acesso para login imediato.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Token'
        '400':
          description: Email já registrado.

  /token:
    post:
      summary: Login (Obter Token)
      description: >
        Endpoint compatível com OAuth2 (Form Data). 
        Recebe 'username' (email) e 'password' e retorna o JWT.
      operationId: login
      security: [] # Rota pública
      requestBody:
        required: true
        content:
          application/x-www-form-urlencoded:
            schema:
              type: object
              required:
                - username
                - password
              properties:
                username:
                  type: string
                  description: O email do usuário.
                password:
                  type: string
                  format: password
      responses:
        '200':
          description: Login realizado com sucesso.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Token'
        '401':
          description: Credenciais inválidas (Email ou senha incorretos).

  # --- ROTAS PROTEGIDAS (TRANSAÇÕES) ---
  /transactions:
    get:
      summary: Listar transações
      description: Retorna o histórico do usuário logado.
      operationId: list_transactions
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
      responses:
        '200':
          description: Lista recuperada.
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/TransactionResponse'

    post:
      summary: Criar transação
      description: Registra uma nova movimentação para o usuário logado.
      operationId: create_transaction
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TransactionCreate'
      responses:
        '201':
          description: Criado com sucesso.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TransactionResponse'

  /transactions/{transaction_id}:
    delete:
      summary: Excluir transação
      description: Remove uma transação (apenas se pertencer ao usuário logado).
      operationId: delete_transaction
      parameters:
        - name: transaction_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '204':
          description: Deletado com sucesso.
        '404':
          description: Transação não encontrada.

  # --- ROTAS PROTEGIDAS (DASHBOARD) ---
  /dashboard/summary:
    get:
      summary: Obter resumo financeiro
      description: Retorna dados agregados (totais e gráfico) para o usuário logado.
      operationId: get_dashboard
      responses:
        '200':
          description: Sucesso.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DashboardSummary'

# --- SCHEMAS (MODELOS DE DADOS) ---
components:
  schemas:
    # Auth Models
    UserCreate:
      type: object
      required:
        - email
        - password
      properties:
        email:
          type: string
          format: email
        password:
          type: string
          minLength: 8

    Token:
      type: object
      properties:
        access_token:
          type: string
        token_type:
          type: string
          example: bearer

    # Transaction Models
    TransactionCreate:
      type: object
      required:
        - amount
        - type
        - category
      properties:
        amount:
          type: number
          format: float
          minimum: 0.01
        type:
          type: string
          enum: [INCOME, EXPENSE]
        category:
          type: string
        description:
          type: string
          nullable: true
        occurred_at:
          type: string
          format: date-time
          nullable: true

    TransactionResponse:
      allOf:
        - $ref: '#/components/schemas/TransactionCreate'
        - type: object
          required:
            - id
            - created_at
          properties:
            id:
              type: string
              format: uuid
            created_at:
              type: string
              format: date-time

    # Dashboard Models
    DashboardSummary:
      type: object
      properties:
        total_balance:
          type: number
          format: float
        total_income:
          type: number
          format: float
        total_expense:
          type: number
          format: float
        by_category:
          type: array
          items:
            $ref: '#/components/schemas/CategoryMetric'

    CategoryMetric:
      type: object
      properties:
        name:
          type: string
        value:
          type: number
          format: float