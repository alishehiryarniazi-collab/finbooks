@echo off
REM ============================================================
REM  FinBooks — start backend + frontend in two windows.
REM  Make sure MySQL (XAMPP) is running first.
REM ============================================================

echo Starting FinBooks...

start "FinBooks API"      cmd /k "cd /d %~dp0backend && npm run dev"
start "FinBooks Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Backend  -> http://localhost:4001
echo Frontend -> http://localhost:5173
echo.
echo Two terminal windows opened. Close them to stop the app.
