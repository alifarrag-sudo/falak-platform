@echo off
echo ============================================
echo  Influencer Management Dashboard
echo ============================================
echo.

:: Kill any existing processes on ports 3001 and 5173
echo Clearing old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 :5173 :4040" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
taskkill /IM node.exe /F >nul 2>&1
timeout /t 2 /nobreak > nul

:: Add Node.js to PATH
set PATH=C:\Program Files\nodejs;%PATH%
set NODE_OPTIONS=--no-warnings

:: Start backend
echo [1/3] Starting backend (port 3001)...
start "Backend (API)" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 5 /nobreak > nul

:: Start Cloudflare tunnel for Instagram OAuth
echo [2/3] Starting public tunnel for OAuth...
start "Tunnel (OAuth)" cmd /k "C:\Users\HP\Desktop\cloudflared.exe tunnel --url http://localhost:3001"
timeout /t 4 /nobreak > nul

:: Start frontend
echo [3/3] Starting frontend (port 5173)...
start "Frontend (UI)" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 5 /nobreak > nul

echo.
echo ============================================
echo  IMPORTANT: Check the "Tunnel (OAuth)" window
echo  Copy the https://...trycloudflare.com URL
echo  Set it as BACKEND_URL in backend/.env
echo ============================================
echo.
start http://localhost:5173
