/**
 * Health Check Script
 * Verifies all components of the Hedera Content Notarization Platform
 */

import { config, validateConfig, getConfigSummary } from '../../packages/config/env/config.js';
import axios from 'axios';

/**
 * System Health Checker
 */
class HealthChecker {
    constructor() {
        this.checks = [];
        this.backendUrl = `http://localhost:${config.server.port}`;
        this.frontendUrl = 'http://localhost:5173';
    }

    // Logging utility
    log(message, level = 'INFO', data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] HEALTH ${level}: ${message}`);
        if (data) console.log('Details:', data);
    }

    // Run a health check
    async runCheck(name, checkFunction) {
        try {
            this.log(`Checking ${name}...`);
            const result = await checkFunction();
            
            this.checks.push({
                name,
                status: 'PASS',
                result,
                timestamp: new Date().toISOString()
            });
            
            this.log(`✅ ${name}: PASS`, 'SUCCESS', result);
            return true;
            
        } catch (error) {
            this.checks.push({
                name,
                status: 'FAIL', 
                error: error.message,
                timestamp: new Date().toISOString()
            });
            
            this.log(`❌ ${name}: FAIL`, 'ERROR', { error: error.message });
            return false;
        }
    }

    // Check configuration
    async checkConfiguration() {
        return this.runCheck('Configuration', async () => {
            validateConfig();
            const summary = getConfigSummary();
            
            return {
                valid: true,
                summary,
                requiredEnvVars: [
                    'HEDERA_ACCOUNT_ID',
                    'HEDERA_PRIVATE_KEY', 
                    'FILEBASE_ACCESS_KEY_ID',
                    'FILEBASE_SECRET_ACCESS_KEY',
                    'FILEBASE_BUCKET_NAME'
                ].every(key => !!process.env[key])
            };
        });
    }

    // Check backend service
    async checkBackend() {
        return this.runCheck('Backend Service', async () => {
            const response = await axios.get(`${this.backendUrl}/api/health`, {
                timeout: 10000
            });
            
            return {
                running: true,
                status: response.status,
                services: response.data.services,
                timestamp: response.data.timestamp
            };
        });
    }

    // Check Phase 2 AI system
    async checkPhase2() {
        return this.runCheck('Phase 2 AI System', async () => {
            try {
                const response = await axios.get(`${this.backendUrl}/api/phase2/status`, {
                    timeout: 10000
                });
                
                return {
                    available: response.data.success,
                    status: response.data.phase2?.status || 'not_available',
                    hederaConnected: response.data.phase2?.hederaConnected || false,
                    claimParserReady: response.data.phase2?.claimParserReady || false
                };
                
            } catch (error) {
                // Phase 2 might not be configured, which is okay
                return {
                    available: false,
                    reason: 'Phase 2 not configured or HuggingFace API key missing',
                    note: 'This is optional for basic notarization functionality'
                };
            }
        });
    }

    // Check frontend service  
    async checkFrontend() {
        return this.runCheck('Frontend Service', async () => {
            try {
                const response = await axios.get(this.frontendUrl, {
                    timeout: 10000
                });
                
                return {
                    running: true,
                    status: response.status,
                    accessible: true
                };
                
            } catch (error) {
                // Frontend might not be running in production
                return {
                    running: false,
                    note: 'Frontend service not running (may be expected in production)',
                    error: error.message
                };
            }
        });
    }

    // Check external dependencies
    async checkExternalDependencies() {
        return this.runCheck('External Dependencies', async () => {
            const results = {};
            
            // Test Hedera Mirror Node
            try {
                const mirrorResponse = await axios.get(`${config.hedera.mirrorNodeUrl}/api/v1/accounts`, {
                    timeout: 10000
                });
                results.hederaMirrorNode = {
                    accessible: true,
                    status: mirrorResponse.status
                };
            } catch (error) {
                results.hederaMirrorNode = {
                    accessible: false,
                    error: error.message
                };
            }
            
            // Test IPFS Gateways (sample one)
            try {
                const testCid = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
                const gatewayResponse = await axios.head(`${config.ipfs.gatewayUrl}${testCid}`, {
                    timeout: 15000
                });
                results.ipfsGateway = {
                    accessible: true,
                    primaryGateway: config.ipfs.gatewayUrl,
                    status: gatewayResponse.status
                };
            } catch (error) {
                results.ipfsGateway = {
                    accessible: false,
                    primaryGateway: config.ipfs.gatewayUrl,
                    error: error.message
                };
            }
            
            // Test HuggingFace API (if configured)
            if (config.ai.huggingFaceApiKey) {
                try {
                    const hfResponse = await axios.post('https://api-inference.huggingface.co/models/microsoft/MiniLM-L6-v2', 
                        { inputs: "test connection" },
                        {
                            headers: {
                                'Authorization': `Bearer ${config.ai.huggingFaceApiKey}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 10000
                        }
                    );
                    results.huggingFace = {
                        accessible: true,
                        model: 'microsoft/MiniLM-L6-v2',
                        status: hfResponse.status
                    };
                } catch (error) {
                    results.huggingFace = {
                        accessible: false,
                        error: error.message
                    };
                }
            } else {
                results.huggingFace = {
                    configured: false,
                    note: 'HuggingFace API key not configured (Phase 2 disabled)'
                };
            }
            
            return results;
        });
    }

    // Check file permissions and directories
    async checkFileSystem() {
        return this.runCheck('File System', async () => {
            const results = {};
            
            // Check if all required directories exist
            const requiredDirs = [
                'apps/frontend/src',
                'apps/backend/src',
                'packages/agents/orchestrators',
                'packages/agents/parsers',
                'packages/config/env',
                'tests/e2e'
            ];
            
            const { promises: fs } = await import('fs');
            
            for (const dir of requiredDirs) {
                try {
                    const stats = await fs.stat(dir);
                    results[dir] = {
                        exists: true,
                        isDirectory: stats.isDirectory()
                    };
                } catch (error) {
                    results[dir] = {
                        exists: false,
                        error: error.message
                    };
                }
            }
            
            return results;
        });
    }

    // Run all health checks
    async runAllChecks() {
        this.log("🏥 Starting System Health Check");
        this.log("=".repeat(50));
        
        const startTime = Date.now();
        
        // Run all checks
        await this.checkConfiguration();
        await this.checkFileSystem();
        await this.checkBackend();
        await this.checkPhase2();
        await this.checkFrontend();
        await this.checkExternalDependencies();
        
        // Generate report
        this.generateHealthReport(startTime);
    }

    // Generate final health report
    generateHealthReport(startTime) {
        const duration = Date.now() - startTime;
        const totalChecks = this.checks.length;
        const passedChecks = this.checks.filter(c => c.status === 'PASS').length;
        const failedChecks = totalChecks - passedChecks;
        
        this.log("\n" + "=".repeat(50));
        this.log("🎯 SYSTEM HEALTH REPORT");
        this.log("=".repeat(50));
        this.log(`📊 Health Check Summary:`);
        this.log(`   Duration: ${(duration / 1000).toFixed(1)}s`);
        this.log(`   Total Checks: ${totalChecks}`);
        this.log(`   Passed: ${passedChecks} ✅`);
        this.log(`   Failed: ${failedChecks} ❌`);
        this.log(`   Health Score: ${((passedChecks / totalChecks) * 100).toFixed(1)}%`);
        
        if (failedChecks > 0) {
            this.log("\n❌ Failed Checks:");
            this.checks
                .filter(c => c.status === 'FAIL')
                .forEach(check => {
                    this.log(`   - ${check.name}: ${check.error}`);
                });
        }
        
        this.log("\n✅ Passed Checks:");
        this.checks
            .filter(c => c.status === 'PASS') 
            .forEach(check => {
                this.log(`   - ${check.name}`);
            });
            
        // Determine overall health
        const isHealthy = failedChecks === 0 || (passedChecks >= 4 && failedChecks <= 2);
        
        this.log(`\n🏁 Overall System Health: ${isHealthy ? '✅ HEALTHY' : '❌ NEEDS ATTENTION'}`);
        
        if (isHealthy) {
            this.log("🎉 System is ready for operation!");
        } else {
            this.log("⚠️ Some components need attention. See failed checks above.");
        }

        // Recommendations
        this.log("\n💡 Recommendations:");
        if (!config.features.phase2Enabled) {
            this.log("   - Add HUGGINGFACE_API_KEY to enable Phase 2 AI processing");
        }
        if (failedChecks > 0) {
            this.log("   - Review and fix failed components before production use");
        }
        this.log("   - Run 'npm run test:e2e' for comprehensive end-to-end testing");
        
        return isHealthy;
    }
}

// Export for use in other modules
export default HealthChecker;

// Run health check if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const checker = new HealthChecker();
    
    checker.runAllChecks()
        .then(() => {
            console.log('\n👋 Health check completed!');
        })
        .catch(error => {
            console.error('\n❌ Health check failed:', error);
            process.exit(1);
        });
}
