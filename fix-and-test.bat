+@echo off
echo 🔧 Switching to Improved Orchestrator
echo ====================================

echo.
echo 1. Stopping old orchestrator...
powershell -Command "try { Invoke-RestMethod -Uri 'http://localhost:3001/api/phase2/stop' -Method POST; Write-Host 'Old orchestrator stopped' -ForegroundColor Yellow } catch { Write-Host 'Old orchestrator already stopped' -ForegroundColor Gray }"

echo.
echo 2. Starting improved orchestrator...
powershell -Command "try { $result = Invoke-RestMethod -Uri 'http://localhost:3001/api/phase2/improved/start' -Method POST; Write-Host $result.message -ForegroundColor Green } catch { Write-Host 'Error:' $_.Exception.Message -ForegroundColor Red }"

echo.
echo 3. Checking improved orchestrator status...
powershell -Command "try { $status = Invoke-RestMethod -Uri 'http://localhost:3001/api/phase2/improved/status' -Method GET; Write-Host 'Status:' $status.status -ForegroundColor Cyan; Write-Host 'Processed Claims:' $status.processedClaimsCount -ForegroundColor Cyan } catch { Write-Host 'Status check failed' -ForegroundColor Red }"

echo.
echo 4. Testing with your failed CID...
set FAILED_CID=bafkreifhe73cssujmpgacfj3btlkjq5en6v6q66auxjfs3dhjevnpavaw4
echo Testing CID: %FAILED_CID%
powershell -Command "try { Write-Host 'Processing CID with improved orchestrator (this may take 1-2 minutes)...' -ForegroundColor Yellow; $result = Invoke-RestMethod -Uri 'http://localhost:3001/api/phase2/improved/process/%FAILED_CID%' -Method POST -TimeoutSec 120; Write-Host 'SUCCESS! AI Processing completed:' -ForegroundColor Green; Write-Host $result.message -ForegroundColor Green } catch { Write-Host 'Processing result:' $_.Exception.Message -ForegroundColor Yellow }"

echo.
echo 5. Checking final status...
powershell -Command "try { $status = Invoke-RestMethod -Uri 'http://localhost:3001/api/phase2/improved/status' -Method GET; Write-Host 'Final Status:' $status.status -ForegroundColor Cyan; Write-Host 'Total Processed Claims:' $status.processedClaimsCount -ForegroundColor Green } catch { Write-Host 'Status check failed' -ForegroundColor Red }"

echo.
echo ✅ Testing completed! 
echo.
echo Next steps:
echo - Upload new content at: http://localhost:5173
echo - Check claims with: powershell -Command "Invoke-RestMethod -Uri 'http://localhost:3001/api/phase2/improved/claims' -Method GET"
echo.
pause
