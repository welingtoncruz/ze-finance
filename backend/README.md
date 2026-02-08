# Zefa Finance Backend

FastAPI backend for Zefa Finance MVP.

## Prerequisites

- Python 3.11+
- Docker Desktop + Docker Compose v2
- pip (Python package manager)

## Quick Start

### 1. Start PostgreSQL Database

From the repository root:

```bash
docker compose up -d db
```

This starts PostgreSQL 15 in a Docker container with persistent storage on port **5433** (to avoid conflicts with other PostgreSQL instances).

### 2. Configure Environment Variables

Copy the example environment file:

**Windows:**
```bash
cd backend
copy .env.example .env
```

**macOS/Linux:**
```bash
cd backend
cp .env.example .env
```

Edit `.env` if you need to change any values (defaults work with Docker Compose).

### 3. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Run the API Server

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --env-file .env
```

The API will be available at:
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

### 5. Run Tests

Tests use SQLite in-memory database and don't require Docker:

```bash
python -m pytest -v
```

## Database Management

### Access Database Admin UI (Optional)

Start Adminer (lightweight database admin tool):

```bash
docker compose --profile tools up -d adminer
```

Access Adminer at: http://localhost:8080

Connection details:
- System: PostgreSQL
- Server: db
- Username: postgres
- Password: postgres_password
- Database: zefa_db

### Stop Database

```bash
docker compose down
```

To remove volumes (deletes all data):

```bash
docker compose down -v
```

## Environment Variables

See `.env.example` for all available environment variables:

### Core Backend
- `DATABASE_URL`: PostgreSQL connection string (must use `postgresql+asyncpg://`)
- `SECRET_KEY`: JWT signing secret (change in production)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: JWT token expiration time
- `ALGORITHM`: JWT algorithm (default: HS256)
- `ALLOWED_ORIGINS`: JSON array of allowed CORS origins

### AI Chat Agent (Zefa)
- `AI_PROVIDER`: AI provider (`openai`, `anthropic`, or `gemini`, default: `openai`)
- `AI_MODEL_CHAT`: Chat model name (default: `gpt-4o-mini`)
- `AI_MAX_CONTEXT_MESSAGES`: Maximum messages in context before summarization (default: `20`)
- `AI_SUMMARY_TOKEN_BUDGET`: Token budget for conversation summaries (default: `500`)
- `AI_MAX_OUTPUT_TOKENS`: Hard cap for assistant output tokens (default: `1500`). Increase if responses are being cut off, decrease to reduce costs.
- `AI_TOOLS_MODE`: Tool attachment mode - `always` (always attach), `heuristic` (attach only for finance queries), `never` (never attach) (default: `heuristic`)
- `AI_TOOL_RESULTS_MAX_CHARS`: Maximum characters for tool result payloads injected into second LLM call (default: `4000`)
- `AI_CONTEXT_PACK_TX_LIMIT`: Maximum number of recent transactions in finance context pack (default: `6`)
- `OPENAI_API_KEY`: OpenAI API key (required if using OpenAI)
- `ANTHROPIC_API_KEY`: Anthropic API key (required if using Anthropic)
- `GEMINI_API_KEY`: Gemini API key (required if using Gemini)

**Note**: If API keys are not set in environment variables, users can provide them temporarily via the `/chat/api-key` endpoint. Ephemeral keys are stored in-memory only and expire after 60 minutes.

## Development Notes

- Database tables are created automatically on startup using `Base.metadata.create_all()` (MVP approach)
- Migrate to Alembic when schema evolution becomes necessary
- All database operations are async (SQLAlchemy Async + AsyncPG)

## Chat Agent (Zefa)

The backend includes an AI-powered chat agent named **Zefa** that can:
- Answer financial queries in Portuguese (pt-BR)
- Execute tools to query user data (balance, transactions)
- Create transactions via natural language
- Analyze spending patterns

### API Endpoints

- `POST /chat/messages`: Send a message and receive Zefa's response with UI metadata (returns envelope with message and meta)
- `POST /chat/api-key`: Set ephemeral API key (in-memory, expires in 60 minutes)

### Architecture

The chat agent follows a modular architecture:
- **Gateway** (`app/ai/gateway.py`): Provider-agnostic AI orchestration
- **Tools** (`app/ai/tools.py`): Finance tool definitions and implementations
- **Prompt** (`app/ai/prompt.py`): System instructions and Zefa persona
- **Chat CRUD** (`app/chat/crud.py`): Message persistence and conversation management
- **Chat Routes** (`app/chat/routes.py`): HTTP endpoints for chat interactions

### Testing

Integration tests are available in `tests/test_chat_agent.py`. Tests use `respx` to mock AI provider API calls.

## Troubleshooting

### Database Connection Issues

1. Ensure Docker Compose is running: `docker compose ps`
2. Check database logs: `docker compose logs db`
3. Verify `DATABASE_URL` in `.env` matches Docker Compose credentials and port (default: 5433)
4. Ensure port 5433 is not already in use

### Port Already in Use

The default configuration uses port **5433** to avoid conflicts. If port 5433 is also in use:
- Stop the conflicting service, or
- Change the port mapping in `docker-compose.yml` (e.g., `"5434:5432"`)
- Update `DATABASE_URL` in `.env` to use the new port (e.g., `localhost:5434`)
