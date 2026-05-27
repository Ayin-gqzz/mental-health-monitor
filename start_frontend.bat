@echo off
cd /d "C:\Users\hegeq\OneDrive\Desktop\数据库\mental-health-monitor\frontend"
echo Starting Frontend on http://localhost:5173 ...
start "MentalHealth-Frontend" npx vite --host
timeout /t 3 >nul
start http://localhost:5173
