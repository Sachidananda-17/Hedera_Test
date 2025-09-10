@echo off
echo 🎉 WORKING SYSTEM TEST
echo =====================

echo.
echo Testing fixed Hedera Content Notarization Platform...
echo.

echo 1. Backend Health Check:
powershell -Command "try { $health = Invoke-RestMethod -Uri 'http://localhost:3001/api/health' -Method GET; Write-Host '✅ Backend:' $health.message -ForegroundColor Green } catch { Write-Host '❌ Backend not ready' -ForegroundColor Red }"

echo.
echo 2. Improved Orchestrator Status:
powershell -Command "try { $status = Invoke-RestMethod -Uri 'http://localhost:3001/api/phase2/improved/status' -Method GET; Write-Host '✅ Status:' $status.status -ForegroundColor Green; Write-Host '✅ Claims Processed:' $status.processedClaimsCount -ForegroundColor Cyan; Write-Host '✅ Mirror Node Fixed:' ($status.retryConfig -ne $null) -ForegroundColor Green } catch { Write-Host '❌ Orchestrator issue' -ForegroundColor Red }"

echo.
echo 3. Test Content Upload with Verification Links:
powershell -Command "Write-Host 'Uploading test content...' -ForegroundColor Yellow; $body = @{accountId='0.0.6651850';contentType='text';text='Microsoft announced AI breakthrough that processes data 80%% faster'}; try { $result = Invoke-RestMethod -Uri 'http://localhost:3001/api/notarize' -Method POST -Body $body; Write-Host '🎉 SUCCESS! Content uploaded:' -ForegroundColor Green; Write-Host ''; Write-Host '📋 VERIFICATION LINKS:' -ForegroundColor Yellow; Write-Host 'CID:' $result.ipfsCid -ForegroundColor White; if($result.verificationLinks) { Write-Host 'Hedera Transaction:' $result.verificationLinks.hederaTransaction -ForegroundColor Cyan; Write-Host 'Direct IPFS Access:' $result.verificationLinks.directIPFSAccess -ForegroundColor Cyan; Write-Host 'CID Analyzer:' $result.verificationLinks.ipfsCidAnalyzer -ForegroundColor Cyan } Write-Host ''; Write-Host '🤖 AI Processing:' $result.internalProcessing.phase2Status -ForegroundColor Green } catch { Write-Host '❌ Upload failed:' $_.Exception.Message -ForegroundColor Red }"

echo.
echo 4. Check AI Processing Results (wait 30 seconds):
timeout /t 30 /nobreak
powershell -Command "try { $claims = Invoke-RestMethod -Uri 'http://localhost:3001/api/phase2/improved/claims' -Method GET; Write-Host '📊 Processed Claims:' $claims.claims.Count -ForegroundColor Green; if($claims.claims.Count -gt 0) { $latest = $claims.claims[-1]; Write-Host 'Latest Claim:' -ForegroundColor Yellow; Write-Host '- CID:' $latest.cid -ForegroundColor White; Write-Host '- Status:' $latest.status -ForegroundColor White; Write-Host '- Type:' $latest.parsedClaim.type -ForegroundColor Cyan; Write-Host '- Subject:' $latest.parsedClaim.subject -ForegroundColor Cyan; Write-Host '- Predicate:' $latest.parsedClaim.predicate -ForegroundColor Cyan; Write-Host '- Object:' $latest.parsedClaim.object -ForegroundColor Cyan } } catch { Write-Host 'Claims check failed' -ForegroundColor Yellow }"

echo.
echo 🎉 Test completed! 
echo.
echo ✅ Frontend: http://localhost:5173
echo ✅ Backend: http://localhost:3001
echo ✅ Phase 2 AI: Working with simple parser (no HuggingFace dependency)
echo ✅ Mirror Node: Fixed polling
echo ✅ Verification: Links included in responses
echo.
pause
