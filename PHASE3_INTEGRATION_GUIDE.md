# Phase 3 Integration Guide

## 🔄 Complete Phase 2 → Phase 3 Data Flow

### **Phase 2 Output** (Your Current System)
```json
{
  "cid": "bafkreiaz6bhvlqb6py5zqq3rntu7dsujmln7mmzyyzc5o4un3fupwu6r2y",
  "type": "question",                    // ← Question detection working!
  "subject": "Earth", 
  "predicate": "is-questioned-about",    // ← Enhanced predicate
  "object": "true",
  "confidence": 0.85,
  "originalText": "In Earth there is no humans is this true",
  "entities": [{"text": "Earth", "label": "LOC", "confidence": 0.99}],
  "method": "huggingface"
}
```

### **Phase 3 Processing** (Evidence Retrieval)
Your Phase 2 data automatically generates these targeted queries:

1. **Original Query**: `"In Earth there is no humans is this true"`
2. **Subject-focused**: `"facts about Earth"`, `"Earth scientific information"`
3. **Question-specific**: `"Earth true"`, `"Earth research studies"`
4. **Entity-based**: `"Earth facts verification"`

### **Phase 3 Output** (For Phase 4)
```json
{
  "claimCid": "bafkreiaz6bhvlqb6py5zqq3rntu7dsujmln7mmzyyzc5o4un3fupwu6r2y",
  "originalClaim": "In Earth there is no humans is this true",
  "claimType": "question",
  "evidence": [
    {
      "query": "Earth scientific information",
      "answer": "Earth is home to approximately 8 billion humans...",
      "confidence": 0.95,
      "source": "rag-model",
      "type": "ai_generated"
    },
    {
      "query": "facts about Earth",
      "answer": "Scientific consensus confirms human population...",
      "confidence": 0.88,
      "source": "perplexity_api", 
      "type": "web_search"
    }
  ],
  "retrievalMethod": "rag_with_fallback",
  "confidence": 0.91,
  "nextPhase": "veracity_prediction"
}
```

## 🛠 Setup Instructions

### 1. **Environment Configuration**
Add to your `.env` file:
```bash
# Existing (working)
HUGGINGFACE_API_KEY=your_key_here

# New for Phase 3
PERPLEXITY_API_KEY=your_perplexity_key_here
```

### 2. **Config Update** 
Add Phase 3 feature flag to `packages/config/env/config.js`:
```javascript
features: {
  phase2Enabled: true,
  phase3Enabled: true,  // ← Add this
  autoEvidencePreparation: true,
  realTimeProcessing: true
}
```

### 3. **Orchestrator Integration**
Uncomment lines 202-220 in `improved-orchestrator.js`:
```javascript
// PHASE 3 INTEGRATION POINT - Evidence Retrieval
// Uncomment to enable Phase 3:
let evidencePackage = null;
if (config.features.phase3Enabled) {
    try {
        this.log(`🔍 PHASE 3: Starting evidence retrieval for CID: ${cid}`, 'INFO');
        evidencePackage = await this.evidenceAgent.retrieveEvidence({
            ...parsedClaim,
            cid: cid,
            originalText: content
        });
        this.log(`✅ PHASE 3: Evidence retrieval completed`, 'SUCCESS', {
            evidenceCount: evidencePackage.evidence.length,
            method: evidencePackage.retrievalMethod
        });
    } catch (error) {
        this.log(`⚠️ PHASE 3: Evidence retrieval failed: ${error.message}`, 'WARN');
    }
}
```

### 4. **Enable the Import**
Uncomment line 7 in `improved-orchestrator.js`:
```javascript
import EvidenceRetrievalAgent from '../evidence/evidence-retrieval-agent.js';
```

### 5. **Initialize Agent in Constructor**
Add to `ImprovedOrchestrator` constructor:
```javascript
this.evidenceAgent = new EvidenceRetrievalAgent();
```

## 🎯 Key Benefits of This Integration

### **Smart Query Generation**
Your enhanced question detection creates better search queries:
- **Before**: Generic search terms
- **After**: Targeted queries based on parsed structure

**Example**:
- Input: `"Is Pluto A Planet"`
- Phase 2: `{type: "question", subject: "Pluto", predicate: "is-questioned-to-be", object: "Planet"}`
- Phase 3: `["Pluto planet status", "Pluto astronomical classification", "planetary definition"]`

### **Seamless Flow**
```
Phase 1: Claim → IPFS → Hedera ✅
Phase 2: IPFS → AI Parsing ✅ 
Phase 3: Parsed Claim → Evidence Retrieval (Ready!)
Phase 4: Evidence → Veracity Prediction (Next)
Phase 5: Results → Dashboard (Final)
```

### **Error Handling**
- **RAG Model fails** → Automatic fallback to Perplexity API
- **No evidence found** → Graceful degradation with confidence scoring
- **API limits** → Built-in query limiting and retries

## 🚀 Testing the Integration

### **Test with Your Recent Claim**
```javascript
// Your actual Phase 2 output becomes Phase 3 input
const phase2Output = {
  cid: "bafkreiaz6bhvlqb6py5zqq3rntu7dsujmln7mmzyyzc5o4un3fupwu6r2y",
  type: "question",
  subject: "Earth", 
  predicate: "is-questioned-about",
  object: "true",
  originalText: "In Earth there is no humans is this true"
};

// Phase 3 will automatically:
// 1. Generate 7 targeted search queries
// 2. Query RAG model for factual information
// 3. Fallback to Perplexity for web sources
// 4. Package evidence for Phase 4 veracity prediction
```

## 📊 Expected Output Flow

### **Real System Logs** (after Phase 3 enabled):
```
[2025-09-10T17:XX:XX] IMPROVED-ORCHESTRATOR: ✅ Claim processing completed
[2025-09-10T17:XX:XX] IMPROVED-ORCHESTRATOR: 🔍 PHASE 3: Starting evidence retrieval
[2025-09-10T17:XX:XX] EVIDENCE-AGENT: 📝 Generated 7 search queries
[2025-09-10T17:XX:XX] EVIDENCE-AGENT: 🤖 Attempting RAG model retrieval
[2025-09-10T17:XX:XX] EVIDENCE-AGENT: 🌐 Fallback to Perplexity API
[2025-09-10T17:XX:XX] IMPROVED-ORCHESTRATOR: ✅ PHASE 3: Evidence retrieval completed
[2025-09-10T17:XX:XX] IMPROVED-ORCHESTRATOR: 🎯 Ready for Phase 4: Veracity Prediction
```

Your Phase 2 implementation provides the **perfect foundation** for Phase 3. The structured claim parsing, question detection, and entity extraction all contribute to generating highly targeted evidence queries! 🎉
