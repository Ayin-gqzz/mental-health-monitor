# 大学生心理健康状况动态监测与预警系统

College Student Mental Health Dynamic Monitoring and Early Warning System.

## Quick Start (Docker)

```bash
docker compose up
```

Then open http://localhost:5173. First launch auto-seeds the database (~2 min).

## Quick Start (Local)

**Backend** (Python 3.12+):

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env
python scripts/seed_db.py
python scripts/simulate_behavior.py
python scripts/assess_all.py
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Frontend** (Node 22+):

```bash
cd frontend
npm install
npx vite
```

## Default Accounts

| Role | Username | Password |
|------|----------|----------|
| Counselor | `counselor` | `123456` |
| Student | Any `Student_ID` from CSV | `123456` |

## Project Structure

```
mental-health-monitor/
├── backend/                # FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── api/            # Route handlers (auth, student, counselor)
│   │   ├── core/           # Config, database, security
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response models
│   │   └── services/       # ML prediction, intervention suggestions
│   ├── ml/                 # Trained model artifacts
│   └── scripts/            # Seed, simulate, assess
├── frontend/               # React 19 + Vite + TypeScript
│   └── src/
│       ├── api/            # Axios API client
│       ├── components/     # Shared UI components
│       ├── pages/          # Route pages
│       └── stores/         # Zustand state
├── sql/                    # Database schema
├── data/                   # CSV dataset
├── docker-compose.yml
└── .env.example
```

## Configuration

Copy `.env.example` to `backend/.env` and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./mental_health.db` | SQLite (default) or MySQL |
| `JWT_SECRET` | (placeholder) | JWT signing key |
| `LLM_API_KEY` | (empty) | Optional LLM for intervention text |

## Data

`data/数据集.csv` — 100,000 student records with lifestyle, academic, and mental health indicators. The target variable is `Depression` (binary classification).

## ML Model

Trained XGBoost classifier using lifestyle features to predict depression risk. Artifacts in `backend/ml/`. Re-train:

```bash
cd backend
python ml/train.py
```
