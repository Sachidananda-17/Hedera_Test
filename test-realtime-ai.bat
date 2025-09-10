@echo off
echo 🧪 Testing Real-Time AI Processing
echo ===================================

echo.
echo 1. Checking server status...
timeout /t 2 >nul
curl -s http://localhost:3001/api/health || echo Server not ready yet

echo.
echo 2. Starting improved orchestrator...
curl -X POST http://localhost:3001/api/phase2/improved/start
echo.

echo 3. Checking orchestrator status...
curl http://localhost:3001/api/phase2/improved/status
echo.

echo 4. Ready to test! 
echo.
echo ✅ Go to: http://localhost:5173
echo ✅ Upload some text content
echo ✅ Check processing status with: curl http://localhost:3001/api/phase2/improved/status
echo ✅ View processed claims with: curl http://localhost:3001/api/phase2/improved/claims

pause
