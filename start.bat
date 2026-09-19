@echo off
echo.
echo   Primit Grid Bot - Starting...
echo.

cd /d "%~dp0"

if not exist "frontend\node_modules" (
  echo   Installing dependencies...
  cd frontend && bun install && cd ..
)

echo   Building frontend...
cd frontend && bun run build && cd ..

echo.
echo   Starting server on http://localhost:3001
echo.
bun run backend/src/index.ts
