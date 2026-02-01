# Development Guide

This guide provides step-by-step instructions for setting up the development environment, running the project locally, and executing tests for the **Zefa Finance** system.

## Setup Instructions

### Prerequisites

Ensure you have the following installed:
- **Python** (v3.11 or higher)
- **Node.js** (v18 or higher) - Required for Next.js 14
- **Docker** and **Docker Compose**
- **Git**

### 1. Clone the Repository

```bash
git clone git@github.com:seu-usuario/zefa-finance.git
cd zefa-finance
2. Environment Configuration
Create environment files for both backend and frontend.

Backend Environment (backend/.env):

Snippet de código
# Database Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_password
POSTGRES_DB=zefa_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Application Configuration
SECRET_KEY="sua_chave_secreta_super_segura_para_dev"
ACCESS_TOKEN_EXPIRE_MINUTES=30
ALLOWED_ORIGINS=["http://localhost:3000"]

# SQLAlchemy Connection String
DATABASE_URL="postgresql+asyncpg://postgres:postgres_password@localhost:5432/zefa_db"
Frontend Environment (frontend/.env.local):

Snippet de código
NEXT_PUBLIC_API_URL=http://localhost:8000
3. Database Setup (via Docker)
We use Docker to run the PostgreSQL database ensuring a consistent environment.

Bash
# Start the database container in detached mode
docker-compose up -d db

# Verify if the database is running
docker-compose ps
The database will be available at:

Host: localhost

Port: 5432

Database: zefa_db

Username: postgres

Password: postgres_password

4. Backend Setup (Local)
Running the backend locally allows for hot-reloading during development.

Bash
# Navigate to backend directory
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the application (Uvicorn)
# The --reload flag enables hot-reloading
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
The backend API will be available at http://localhost:8000. Link to Interactive Docs (Swagger): http://localhost:8000/docs

5. Frontend Setup (Local)
Bash
# Navigate to frontend directory (from project root)
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
The frontend application will be available at http://localhost:3000.

6. Running with Docker Compose (Full Stack)
If you prefer to run the entire stack (Database + Backend + Frontend) inside Docker containers (e.g., to validate the "Walking Skeleton"):

Bash
# Build and start all services
docker-compose up --build

# To stop services
docker-compose down
🧪 Testing
Backend Testing (Pytest)
We use Pytest for unit and integration testing.

Bash
# From the backend directory (with venv activated)
cd backend

# Run all tests
pytest

# Run tests with output logs
pytest -s

# Run a specific test file
pytest tests/test_transactions.py
Frontend Testing (Linting & Build)
For the MVP, we focus on static analysis and build validation.

Bash
# From the frontend directory
cd frontend

# Run linting
npm run lint

# Check if the project builds correctly
npm run build
Common Tasks
Database Migrations
Currently, the project uses Base.metadata.create_all in main.py for auto-migration during development. If you reset the database:

Stop the containers: docker-compose down

Remove the volume (optional, wipes data): docker volume prune

Restart: docker-compose up -d db

Adding a New Python Dependency
Install the package: pip install package_name

Update requirements: pip freeze > requirements.txt

Project Structure
Plaintext
zefa-finance/
├── backend/                # FastAPI Application
│   ├── app/
│   │   ├── routers/        # API Endpoints
│   │   ├── models.py       # SQLAlchemy Models
│   │   ├── schemas.py      # Pydantic Schemas
│   │   └── crud.py         # Business Logic
│   └── tests/              # Pytest Suite
├── frontend/               # Next.js Application
│   ├── app/                # App Router Pages
│   ├── components/         # ShadcnUI Components
│   └── lib/                # Utilities (Axios, Utils)
└── docker-compose.yml      # Infrastructure Orchestration