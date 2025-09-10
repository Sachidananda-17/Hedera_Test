@echo off
echo 📊 Monitoring Real-Time AI Processing
echo ======================================

:loop
echo.
echo [%time%] Checking orchestrator status...
powershell -Command "$status = Invoke-RestMethod -Uri 'http://localhost:3001/api/phase2/improved/status' -Method GET; Write-Host 'Status:' $status.status -ForegroundColor Green; Write-Host 'Claims Processed:' $status.processedClaimsCount -ForegroundColor Cyan; Write-Host 'Last Activity:' $status.lastProcessedTimestamp -ForegroundColor Gray"

echo.
echo [%time%] Recent processed claims:
powershell -Command "try { $claims = Invoke-RestMethod -Uri 'http://localhost:3001/api/phase2/improved/claims' -Method GET; if($claims.success -and $claims.claims.Count -gt 0) { Write-Host 'Latest Claims:' -ForegroundColor Yellow; $claims.claims | ForEach-Object { Write-Host '- CID:' $_.cid 'Status:' $_.status 'Time:' $_.timestamp -ForegroundColor White } } else { Write-Host 'No processed claims yet' -ForegroundColor Gray } } catch { Write-Host 'Error fetching claims' -ForegroundColor Red }"

echo.
echo Refreshing in 30 seconds... (Press Ctrl+C to stop)
timeout /t 30 /nobreak >nul
goto loop
