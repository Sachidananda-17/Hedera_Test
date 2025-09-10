# PowerShell script to test improved AI processing
Write-Host "🧪 Testing Improved AI Processing" -ForegroundColor Green

# Wait for server to be ready
Start-Sleep -Seconds 3

# Step 1: Check server health
Write-Host "`n1. Checking server health..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method GET
    Write-Host "✅ Server Status: $($health.message)" -ForegroundColor Green
} catch {
    Write-Host "❌ Server not ready. Please start with 'npm run dev'" -ForegroundColor Red
    exit 1
}

# Step 2: Start improved orchestrator
Write-Host "`n2. Starting improved orchestrator..." -ForegroundColor Cyan
try {
    $start = Invoke-RestMethod -Uri "http://localhost:3001/api/phase2/improved/start" -Method POST
    Write-Host "✅ $($start.message)" -ForegroundColor Green
} catch {
    Write-Host "⚠️ $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 3: Check orchestrator status
Write-Host "`n3. Checking orchestrator status..." -ForegroundColor Cyan
try {
    $status = Invoke-RestMethod -Uri "http://localhost:3001/api/phase2/improved/status" -Method GET
    Write-Host "📊 Status: $($status.status)" -ForegroundColor Green
    Write-Host "📊 Processed Claims: $($status.processedClaimsCount)" -ForegroundColor Green
    Write-Host "📊 Retry Config: $($status.retryConfig.maxRetries) attempts, $($status.retryConfig.baseDelay)ms base delay" -ForegroundColor Green
} catch {
    Write-Host "❌ $($_.Exception.Message)" -ForegroundColor Red
}

# Step 4: Test content upload
Write-Host "`n4. Testing content upload with AI processing..." -ForegroundColor Cyan
try {
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    
    $bodyLines = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"accountId`"$LF",
        "0.0.6651850",
        "--$boundary",
        "Content-Disposition: form-data; name=`"contentType`"$LF", 
        "text",
        "--$boundary",
        "Content-Disposition: form-data; name=`"text`"$LF",
        "Tesla announced a new battery technology that increases energy density by 40% and reduces charging time by 50%.",
        "--$boundary--$LF"
    ) -join $LF
    
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/notarize" -Method POST -ContentType "multipart/form-data; boundary=$boundary" -Body $bodyLines
    
    if ($response.success) {
        Write-Host "✅ Content uploaded successfully!" -ForegroundColor Green
        Write-Host "📝 CID: $($response.cid)" -ForegroundColor Cyan
        Write-Host "⚡ Hedera Hash: $($response.hederaTxHash)" -ForegroundColor Cyan
        
        # Wait and check processing
        Write-Host "`n5. Waiting for AI processing (this may take up to 1 minute)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 45
        
        # Check if claim was processed
        try {
            $processResult = Invoke-RestMethod -Uri "http://localhost:3001/api/phase2/improved/process/$($response.cid)" -Method POST
            Write-Host "✅ AI Processing completed!" -ForegroundColor Green
            Write-Host "🤖 Claim Type: $($processResult.claim.parsedClaim.type)" -ForegroundColor Cyan
        } catch {
            Write-Host "⚠️ AI processing may still be running. Check status later." -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Upload failed: $($response.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Upload test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Test completed! Check your browser at http://localhost:5173 for the UI" -ForegroundColor Green
Write-Host "📊 Monitor status at: http://localhost:3001/api/phase2/improved/status" -ForegroundColor Cyan
