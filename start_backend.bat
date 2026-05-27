@echo off
cd /d "C:\Users\hegeq\OneDrive\Desktop\数据库\mental-health-monitor\backend"
echo Starting Backend on http://127.0.0.1:8000 ...
start "MentalHealth-Backend" python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
