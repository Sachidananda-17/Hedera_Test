/**
 * Complete End-to-End Flow Test
 * Tests the entire Hedera Content Notarization Platform from frontend to Phase 2
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import { config } from '../../packages/config/env/config.js';

/**
 * E2E Test Runner
 */
class CompleteFlowTest {
    constructor() {
        this.processes = [];
        this.testResults = [];
        this.frontendUrl = 'http://localhost:5173';
        this.backendUrl = `http://localhost:${config.server.port}`;
        this.testClaims = [
            {
                name: "Simple Text Claim",
                text: "Tesla announced a new battery technology that increases energy density by 40%.",
                expectedType: "quantified"
            },
            {
                name: "Scientific Research Claim", 
                text: "Researchers at MIT discovered a new treatment that reduces cancer cell growth by 75% in laboratory studies.",
                expectedType: "scientific"
            },
            {
                name: "Corporate Announcement",
                text: "Apple Inc. launched a revolutionary AI chip that processes data 10x faster than previous generations.",
                expectedType: "quantified"
            }
        ];
    }

    // Logging utility
    log(message, level = 'INFO', data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] E2E-TEST ${level}: ${message}`);
        if (data) console.log('Data:', data);
    }

    // Start required services
    async startServices() {
        this.log("🚀 Starting required services...");
        
        try {
            // Start backend server
            this.log("Starting backend server...");
            const backendProcess = spawn('npm', ['start'], {
                cwd: path.resolve('./apps/backend'),
                stdio: 'pipe',
                shell: true
            });
            
            this.processes.push({ name: 'backend', process: backendProcess });
            
            // Wait for backend to start
            await this.waitForService(this.backendUrl, '/api/health', 30000);
            this.log("✅ Backend server started successfully");

            // Start frontend server
            this.log("Starting frontend server...");
            const frontendProcess = spawn('npm', ['run', 'dev'], {
                cwd: path.resolve('./apps/frontend'),
                stdio: 'pipe', 
                shell: true
            });
            
            this.processes.push({ name: 'frontend', process: frontendProcess });
            
            // Wait for frontend to start
            await this.waitForService(this.frontendUrl, '/', 30000);
            this.log("✅ Frontend server started successfully");

            return true;
        } catch (error) {
            this.log("❌ Failed to start services", 'ERROR', { error: error.message });
            throw error;
        }
    }

    // Wait for service to be available
    async waitForService(baseUrl, endpoint, timeout = 30000) {
        const startTime = Date.now();
        const url = `${baseUrl}${endpoint}`;
        
        while (Date.now() - startTime < timeout) {
            try {
                const response = await axios.get(url, { timeout: 5000 });
                if (response.status === 200) {
                    return true;
                }
            } catch (error) {
                // Service not ready yet, continue waiting
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        throw new Error(`Service at ${url} did not become available within ${timeout}ms`);
    }

    // Test backend health and configuration
    async testBackendHealth() {
        this.log("🏥 Testing backend health and configuration...");
        
        try {
            const response = await axios.get(`${this.backendUrl}/api/health`);
            const healthData = response.data;
            
            this.logResult("Backend Health Check", true, {
                services: healthData.services,
                timestamp: healthData.timestamp
            });

            // Check required services
            const requiredServices = ['hedera', 'filebase', 'ipfs'];
            for (const service of requiredServices) {
                if (!healthData.services[service]) {
                    throw new Error(`Required service '${service}' is not configured`);
                }
            }

            this.log("✅ All required backend services are configured");
            return true;
            
        } catch (error) {
            this.logResult("Backend Health Check", false, { error: error.message });
            throw error;
        }
    }

    // Test Phase 2 availability
    async testPhase2Availability() {
        this.log("🤖 Testing Phase 2 AI system availability...");
        
        try {
            const response = await axios.get(`${this.backendUrl}/api/phase2/status`);
            const phase2Data = response.data;
            
            if (!phase2Data.success) {
                this.log("⚠️ Phase 2 not available - continuing without AI processing");
                this.logResult("Phase 2 Availability", false, { 
                    reason: "Phase 2 not configured",
                    message: phase2Data.message 
                });
                return false;
            }

            this.logResult("Phase 2 Availability", true, {
                status: phase2Data.phase2.status,
                hederaConnected: phase2Data.phase2.hederaConnected,
                claimParserReady: phase2Data.phase2.claimParserReady
            });

            return true;
            
        } catch (error) {
            this.logResult("Phase 2 Availability", false, { error: error.message });
            return false;
        }
    }

    // Test content notarization flow
    async testNotarizationFlow() {
        this.log("📝 Testing content notarization flow...");
        
        const results = [];
        
        for (const [index, testClaim] of this.testClaims.entries()) {
            try {
                this.log(`Testing claim ${index + 1}: ${testClaim.name}`);
                
                // Prepare notarization request
                const formData = new FormData();
                formData.append('accountId', config.hedera.accountId);
                formData.append('contentType', 'text');
                formData.append('text', testClaim.text);
                formData.append('title', testClaim.name);
                formData.append('tags', 'e2e-test,automated');

                // Submit notarization request
                const response = await axios.post(`${this.backendUrl}/api/notarize`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    },
                    timeout: 60000 // 60 second timeout
                });

                if (!response.data.success) {
                    throw new Error(`Notarization failed: ${response.data.message}`);
                }

                const notarization = response.data;
                
                // Verify notarization result
                this.verifyNotarizationResult(notarization, testClaim);
                
                results.push({
                    claim: testClaim.name,
                    success: true,
                    cid: notarization.ipfsCid,
                    transactionHash: notarization.hederaTransactionHash,
                    processingTime: notarization.debug?.processingTime
                });

                this.log(`✅ Notarization successful for: ${testClaim.name}`, 'SUCCESS', {
                    cid: notarization.ipfsCid,
                    transactionHash: notarization.hederaTransactionHash
                });

                // Wait a bit before next test
                await new Promise(resolve => setTimeout(resolve, 3000));
                
            } catch (error) {
                this.log(`❌ Notarization failed for: ${testClaim.name}`, 'ERROR', { 
                    error: error.message 
                });
                
                results.push({
                    claim: testClaim.name,
                    success: false,
                    error: error.message
                });
            }
        }

        this.logResult("Content Notarization Flow", results.every(r => r.success), {
            totalTests: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        });

        return results;
    }

    // Verify notarization result
    verifyNotarizationResult(result, testClaim) {
        // Check required fields
        if (!result.ipfsCid) throw new Error('Missing IPFS CID');
        if (!result.hederaTransactionHash) throw new Error('Missing Hedera transaction hash');
        if (!result.timestamp) throw new Error('Missing timestamp');

        // Verify CID format (basic check)
        if (!result.ipfsCid.startsWith('Qm') && !result.ipfsCid.startsWith('baf')) {
            throw new Error(`Invalid CID format: ${result.ipfsCid}`);
        }

        // Verify Hedera transaction hash format
        if (!result.hederaTransactionHash.includes('@')) {
            throw new Error(`Invalid transaction hash format: ${result.hederaTransactionHash}`);
        }

        this.log(`✅ Notarization result verified for: ${testClaim.name}`);
    }

    // Test Phase 2 claim processing (if available)
    async testPhase2Processing(notarizationResults) {
        if (!config.features.phase2Enabled) {
            this.log("⏭️ Phase 2 not enabled, skipping AI processing tests");
            return;
        }

        this.log("🧠 Testing Phase 2 claim processing...");
        
        try {
            // Start Phase 2 processing
            await axios.post(`${this.backendUrl}/api/phase2/start`);
            this.log("✅ Phase 2 processing started");

            // Wait for claims to be processed
            await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds

            // Check processed claims
            const response = await axios.get(`${this.backendUrl}/api/phase2/claims`);
            const processedClaims = response.data.claims;

            this.logResult("Phase 2 Claim Processing", processedClaims.length > 0, {
                totalProcessed: processedClaims.length,
                claims: processedClaims.map(claim => ({
                    cid: claim.cid,
                    claimType: claim.structuredData.claimType,
                    confidence: claim.structuredData.confidence
                }))
            });

            return processedClaims;

        } catch (error) {
            this.logResult("Phase 2 Claim Processing", false, { error: error.message });
            throw error;
        }
    }

    // Test IPFS content accessibility
    async testIPFSAccessibility(notarizationResults) {
        this.log("🌐 Testing IPFS content accessibility...");
        
        const accessibilityResults = [];
        
        for (const result of notarizationResults.filter(r => r.success)) {
            try {
                // Try to access content via IPFS gateway
                const ipfsUrl = `${config.ipfs.gatewayUrl}${result.cid}`;
                const response = await axios.get(ipfsUrl, { timeout: 15000 });
                
                if (response.status === 200 && response.data) {
                    accessibilityResults.push({
                        cid: result.cid,
                        accessible: true,
                        contentLength: response.data.length
                    });
                    
                    this.log(`✅ IPFS content accessible for CID: ${result.cid}`);
                } else {
                    throw new Error(`Unexpected response: ${response.status}`);
                }
                
            } catch (error) {
                accessibilityResults.push({
                    cid: result.cid,
                    accessible: false,
                    error: error.message
                });
                
                this.log(`⚠️ IPFS content not accessible for CID: ${result.cid}`, 'WARN', {
                    error: error.message
                });
            }
        }

        const accessibleCount = accessibilityResults.filter(r => r.accessible).length;
        this.logResult("IPFS Content Accessibility", accessibleCount > 0, {
            totalTested: accessibilityResults.length,
            accessible: accessibleCount,
            results: accessibilityResults
        });

        return accessibilityResults;
    }

    // Run complete test suite
    async runCompleteTest() {
        this.log("🎬 Starting Complete End-to-End Flow Test");
        this.log("=".repeat(60));
        
        const startTime = Date.now();
        
        try {
            // 1. Start services
            await this.startServices();
            
            // 2. Test backend health
            await this.testBackendHealth();
            
            // 3. Test Phase 2 availability
            const phase2Available = await this.testPhase2Availability();
            
            // 4. Test notarization flow
            const notarizationResults = await this.testNotarizationFlow();
            
            // 5. Test IPFS accessibility
            await this.testIPFSAccessibility(notarizationResults);
            
            // 6. Test Phase 2 processing (if available)
            if (phase2Available) {
                await this.testPhase2Processing(notarizationResults);
            }
            
            // 7. Generate final report
            this.generateFinalReport(startTime);
            
        } catch (error) {
            this.log("❌ Complete test failed", 'ERROR', { error: error.message });
            throw error;
        } finally {
            // Cleanup
            await this.cleanup();
        }
    }

    // Log test result
    logResult(testName, success, details = null) {
        this.testResults.push({
            test: testName,
            success,
            details,
            timestamp: new Date().toISOString()
        });
        
        const status = success ? '✅ PASS' : '❌ FAIL';
        this.log(`${status}: ${testName}`, success ? 'SUCCESS' : 'ERROR', details);
    }

    // Generate final test report
    generateFinalReport(startTime) {
        const duration = Date.now() - startTime;
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.success).length;
        const failedTests = totalTests - passedTests;
        
        this.log("\n" + "=".repeat(60));
        this.log("🎯 COMPLETE E2E TEST RESULTS");
        this.log("=".repeat(60));
        this.log(`📊 Test Summary:`);
        this.log(`   Duration: ${(duration / 1000).toFixed(1)}s`);
        this.log(`   Total Tests: ${totalTests}`);
        this.log(`   Passed: ${passedTests} ✅`);
        this.log(`   Failed: ${failedTests} ❌`);
        this.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
        
        if (failedTests > 0) {
            this.log("\n❌ Failed Tests:");
            this.testResults
                .filter(r => !r.success)
                .forEach(result => {
                    this.log(`   - ${result.test}: ${result.details?.error || 'Unknown error'}`);
                });
        }
        
        this.log("\n✅ Passed Tests:");
        this.testResults
            .filter(r => r.success)
            .forEach(result => {
                this.log(`   - ${result.test}`);
            });
            
        const overallSuccess = failedTests === 0;
        this.log(`\n🏁 Overall Result: ${overallSuccess ? '✅ SUCCESS' : '❌ FAILURE'}`);
        
        if (overallSuccess) {
            this.log("🎉 All systems are working correctly!");
            this.log("🚀 The Hedera Content Notarization Platform is ready for production!");
        } else {
            this.log("⚠️ Some tests failed. Please review the errors above.");
        }
    }

    // Cleanup processes
    async cleanup() {
        this.log("🧹 Cleaning up test processes...");
        
        for (const processInfo of this.processes) {
            try {
                processInfo.process.kill('SIGTERM');
                this.log(`✅ Stopped ${processInfo.name} process`);
            } catch (error) {
                this.log(`⚠️ Failed to stop ${processInfo.name} process`, 'WARN', { 
                    error: error.message 
                });
            }
        }
        
        // Wait a bit for processes to stop
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        this.log("✅ Cleanup completed");
    }
}

// Export for use in other modules
export default CompleteFlowTest;

// Run test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const testRunner = new CompleteFlowTest();
    
    testRunner.runCompleteTest()
        .then(() => {
            console.log('\n👋 E2E test completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ E2E test failed:', error);
            process.exit(1);
        });
}
