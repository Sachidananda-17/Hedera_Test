# 🚀 Quick Start Testing Guide

## ⚡ Immediate Testing Instructions

After the reorganization, here's how to test the complete system:

### 1. 🔧 Set Up Environment

```bash
# Navigate to project root
cd C:\Users\Manideep\Desktop\Hedera_Test

# Copy your existing .env file to new location
copy backend\.env apps\backend\config\.env

# Or create new configuration from template
copy packages\config\env\template.env apps\backend\config\.env
# Edit apps\backend\config\.env with your credentials
```

### 2. 🏥 Health Check (Verify Setup)

```bash
# Install dependencies (if needed)
npm install

# Run comprehensive health check
npm run health
```

**Expected Output:**
```
✅ Configuration: PASS
✅ File System: PASS
✅ Backend Service: PASS (if running)
✅ Phase 2 AI System: PASS (if HuggingFace key configured)
✅ External Dependencies: PASS
```

### 3. 🌐 Start Development Servers

**Option A: Start Everything** (Recommended)
```bash
npm run dev
```

**Option B: Start Individually**
```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend  
npm run dev:frontend
```

### 4. 🧪 Run End-to-End Tests

```bash
# Comprehensive test suite
npm run test:e2e
```

**What this tests:**
- ✅ Service startup
- ✅ Backend health and connectivity
- ✅ Phase 2 AI availability
- ✅ Complete notarization workflow
- ✅ IPFS content accessibility
- ✅ AI claim processing (if enabled)

### 5. 📱 Manual Testing

1. **Open Frontend**: http://localhost:5173
2. **Connect HashPack Wallet**
3. **Submit Test Content**:
   - Text: "Tesla announced a new battery that increases efficiency by 40%"
   - Click "Notarize Content"
4. **Verify Results**:
   - Check IPFS link accessibility
   - Verify Hedera transaction on HashScan
   - (If Phase 2 enabled) Check claim parsing

### 6. 🤖 Test Phase 2 AI Processing

**Check Phase 2 Status:**
```bash
curl http://localhost:3001/api/phase2/status
```

**Start Phase 2 Processing:**
```bash
curl -X POST http://localhost:3001/api/phase2/start
```

**View Processed Claims:**
```bash
curl http://localhost:3001/api/phase2/claims
```

---

## 🚨 Troubleshooting Quick Fixes

### Configuration Issues
```bash
# Check what's missing
npm run health

# Common fixes:
# 1. Copy .env to new location: apps/backend/config/.env
# 2. Ensure all required fields are filled
# 3. Check Hedera account has test HBAR
```

### Import Path Errors
```bash
# If you see import errors, the reorganization broke some paths
# Most critical paths have been updated, but some might be missed
# Check console errors and fix import paths as needed
```

### Phase 2 Not Working
```bash
# Phase 2 requires HuggingFace API key
# Add to apps/backend/config/.env:
HUGGINGFACE_API_KEY=hf_your_key_here

# Restart server and try again
```

---

## 📊 Success Criteria

### ✅ Basic System Health
- [ ] `npm run health` shows all green checkmarks
- [ ] Backend starts without errors
- [ ] Frontend loads at http://localhost:5173
- [ ] Configuration validation passes

### ✅ Phase 1 Functionality  
- [ ] HashPack wallet connects
- [ ] Content submission works
- [ ] IPFS CID generated
- [ ] Hedera transaction recorded
- [ ] Links are accessible

### ✅ Phase 2 AI Processing
- [ ] Phase 2 status shows "available"
- [ ] Claims are parsed correctly
- [ ] Structured data is generated
- [ ] Evidence preparation works

### ✅ End-to-End Flow
- [ ] Complete test suite passes
- [ ] All services start automatically
- [ ] Real content flows through system
- [ ] Results are verifiable

---

## 🎯 Next Steps After Testing

1. **If Everything Works**: 
   - System is ready for production
   - Consider adding more test claims
   - Set up monitoring and alerts

2. **If Issues Found**:
   - Check error logs in terminal
   - Run `npm run health` for diagnostics
   - Fix configuration or missing dependencies
   - Re-run tests

3. **For Production Deployment**:
   - Set `NODE_ENV=production`
   - Configure proper CORS origins
   - Enable HTTPS
   - Set up process monitoring

---

## 💡 Pro Tips

- **Use `npm run health`** frequently to diagnose issues
- **Check browser console** for frontend errors  
- **Monitor backend logs** for detailed error information
- **Test with different content types** (text, images)
- **Verify Phase 2 claims** have proper structure and confidence scores

**Happy Testing! 🎉**
