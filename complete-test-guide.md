# Real-Time AI Processing Test Guide

## 🎯 What You've Fixed

✅ **Switched from old orchestrator to improved orchestrator**
✅ **Added proper IPFS propagation delay (30 seconds)**
✅ **Added exponential backoff retry (up to 5 attempts)**
✅ **Added multiple gateway fallback logic**

## 🧪 Testing Steps

### Method 1: Browser Testing (Recommended)

1. **Open Browser**: Go to `http://localhost:5173`
2. **Upload Content**: Try these test texts:
   - "Tesla announced a new battery technology that increases range by 60%"
   - "Apple released iOS 18 with 40% faster performance"
   - "Microsoft launches AI assistant with 90% accuracy improvement"
3. **Monitor Processing**: Watch the terminal logs for improved orchestrator activity
4. **Check Results**: The orchestrator will:
   - Wait 30 seconds for IPFS propagation
   - Try multiple gateways with retry logic
   - Parse content with AI fallback methods

### Method 2: Command Line Testing

```batch
# 1. Check server health
powershell -Command "Invoke-RestMethod -Uri 'http://localhost:3001/api/health' -Method GET"

# 2. Start improved orchestrator
powershell -Command "Invoke-RestMethod -Uri 'http://localhost:3001/api/phase2/improved/start' -Method POST"

# 3. Check status
powershell -Command "Invoke-RestMethod -Uri 'http://localhost:3001/api/phase2/improved/status' -Method GET"

# 4. Upload test content
powershell -Command "$body = @{ accountId='0.0.6651850'; contentType='text'; text='Tesla announced breakthrough battery technology' }; Invoke-RestMethod -Uri 'http://localhost:3001/api/notarize' -Method POST -Body $body"

# 5. Monitor claims (wait 1-2 minutes after upload)
powershell -Command "Invoke-RestMethod -Uri 'http://localhost:3001/api/phase2/improved/claims' -Method GET"
```

### Method 3: Continuous Monitoring

Run the monitoring script:
```batch
monitor-ai.bat
```

## 🔍 What to Look For

### In Terminal Logs:
- `IMPROVED-ORCHESTRATOR INFO: ⏳ Waiting 30000ms for IPFS propagation...`
- `IMPROVED-ORCHESTRATOR INFO: 🔄 Attempt 1/5 to fetch content`
- `IMPROVED-ORCHESTRATOR SUCCESS: ✅ Content successfully retrieved`

### Expected Behavior:
1. **Upload Success**: Content uploaded to Filebase ✅
2. **Hedera Success**: Transaction recorded on blockchain ✅
3. **IPFS Propagation Wait**: 30-second delay before fetching ⏳
4. **Retry Logic**: Multiple attempts with exponential backoff 🔄
5. **AI Processing**: Content parsed with fallback methods 🤖

### Success Indicators:
- Status: `running`
- Processed Claims: `> 0`
- Claim Status: `completed`
- Processing Time: `< 120000ms`

## 🚨 Troubleshooting

### If HuggingFace API Fails:
- **Expected**: System uses fallback AI methods
- **Action**: Add `HUGGINGFACE_API_KEY` to your .env for better AI processing

### If IPFS Gateways Timeout:
- **Expected**: Improved orchestrator retries with delays
- **Action**: Wait for retry cycles to complete (up to 2 minutes)

### If Claims Show "failed" Status:
- **Check**: Processing time should be > 30 seconds (propagation delay)
- **Retry**: Use manual processing endpoint for specific CIDs

## ✅ Success Criteria

Your real-time AI processing is working when:
1. Orchestrator status shows `running`
2. Claims are processed with `completed` status
3. Processing includes propagation wait time
4. AI parsing returns structured data (even with fallbacks)

## 🎉 Next Steps

Once working:
- Add HuggingFace API key for better AI results
- Test with different content types
- Monitor long-term processing stability
- Scale up content upload frequency
