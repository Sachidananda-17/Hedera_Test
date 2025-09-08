import Phase2Orchestrator from './phase2-orchestrator.js';
import ClaimParserAgent from './claim-parser-agent.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Phase 2 Test Runner
 * Tests the complete Fetch.ai orchestrator workflow
 */
class Phase2TestRunner {
    constructor() {
        this.orchestrator = null;
        this.claimParser = null;
        this.testResults = [];
    }

    // Main test execution
    async runTests() {
        console.log('🧪 Starting Phase 2 Test Suite\n');
        console.log('=' * 50);

        try {
            // Test 1: Initialize components
            await this.testComponentInitialization();

            // Test 2: Test claim parser individually
            await this.testClaimParser();

            // Test 3: Test IPFS content fetching
            await this.testIPFSFetching();

            // Test 4: Test complete workflow
            await this.testCompleteWorkflow();

            // Test 5: Test with various claim types
            await this.testVariousClaimTypes();

            // Display results
            this.displayTestResults();

        } catch (error) {
            console.error('❌ Test suite failed:', error);
        }
    }

    // Test 1: Component initialization
    async testComponentInitialization() {
        console.log('\n🔧 Test 1: Component Initialization');
        console.log('-'.repeat(40));

        try {
            // Initialize orchestrator
            this.orchestrator = new Phase2Orchestrator();
            this.logResult('Orchestrator initialized', true);

            // Initialize claim parser
            this.claimParser = new ClaimParserAgent();
            await this.claimParser.initialize();
            this.logResult('Claim parser initialized', true);

            // Check HuggingFace connection
            const parserStatus = this.claimParser.getStatus();
            this.logResult('HuggingFace connection', parserStatus.initialized);

            console.log('✅ Component initialization completed');

        } catch (error) {
            console.error('❌ Component initialization failed:', error);
            this.logResult('Component initialization', false, error.message);
        }
    }

    // Test 2: Individual claim parser testing
    async testClaimParser() {
        console.log('\n🧠 Test 2: Claim Parser Testing');
        console.log('-'.repeat(40));

        const testClaims = [
            {
                text: "The company XYZ announced a new AI product that increases productivity by 50% compared to traditional methods.",
                expectedType: "quantified",
                description: "Quantified corporate claim"
            },
            {
                text: "Scientists at University ABC discovered a new treatment that reduces cancer cell growth by 75% in laboratory tests.",
                expectedType: "quantified", 
                description: "Quantified scientific claim"
            },
            {
                text: "The new algorithm is more efficient than the previous version in processing large datasets.",
                expectedType: "comparative",
                description: "Comparative claim"
            },
            {
                text: "Research shows that renewable energy adoption increased significantly in developing countries.",
                expectedType: "scientific",
                description: "Scientific claim without quantification"
            }
        ];

        for (const [index, testClaim] of testClaims.entries()) {
            try {
                console.log(`\n📝 Testing claim ${index + 1}: ${testClaim.description}`);
                console.log(`Text: "${testClaim.text}"`);

                const result = await this.claimParser.parseClaim(testClaim.text);
                
                console.log('📊 Results:');
                console.log(`  - Subject: "${result.structuredClaim.subject}"`);
                console.log(`  - Predicate: "${result.structuredClaim.predicate}"`);
                console.log(`  - Object: "${result.structuredClaim.object}"`);
                console.log(`  - Type: ${result.structuredClaim.claimType}`);
                console.log(`  - Confidence: ${(result.structuredClaim.confidence * 100).toFixed(1)}%`);

                if (result.structuredClaim.quantifier) {
                    console.log(`  - Quantifier: ${result.structuredClaim.quantifier}`);
                }

                if (result.structuredClaim.entities) {
                    const entityCount = Object.values(result.structuredClaim.entities).flat().length;
                    console.log(`  - Entities extracted: ${entityCount}`);
                }

                const typeMatched = result.structuredClaim.claimType === testClaim.expectedType;
                this.logResult(`Claim ${index + 1} parsing`, true);
                this.logResult(`Claim ${index + 1} type matching`, typeMatched);

                if (!typeMatched) {
                    console.log(`  ⚠️  Expected type: ${testClaim.expectedType}, Got: ${result.structuredClaim.claimType}`);
                }

            } catch (error) {
                console.error(`❌ Claim ${index + 1} parsing failed:`, error);
                this.logResult(`Claim ${index + 1} parsing`, false, error.message);
            }
        }
    }

    // Test 3: IPFS content fetching
    async testIPFSFetching() {
        console.log('\n🌐 Test 3: IPFS Content Fetching');
        console.log('-'.repeat(40));

        // Test with mock CIDs
        const testCIDs = [
            "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
            "QmRjQtQ6HdqhddTJCiXnvStgzQ4oGtQfyA9PJsG4b1Uj5N",
            "QmInvalidCIDForTesting123456789"
        ];

        for (const [index, cid] of testCIDs.entries()) {
            try {
                console.log(`\n📡 Testing CID ${index + 1}: ${cid}`);
                
                const content = await this.orchestrator.fetchIPFSContent(cid);
                
                if (content) {
                    console.log(`✅ Content fetched successfully`);
                    console.log(`   Length: ${content.length} characters`);
                    console.log(`   Preview: "${content.substring(0, 100)}..."`);
                    this.logResult(`IPFS fetch CID ${index + 1}`, true);
                } else {
                    console.log(`⚠️  No content returned for CID`);
                    this.logResult(`IPFS fetch CID ${index + 1}`, false, 'No content returned');
                }

            } catch (error) {
                console.error(`❌ IPFS fetch failed for CID ${index + 1}:`, error.message);
                this.logResult(`IPFS fetch CID ${index + 1}`, false, error.message);
            }
        }
    }

    // Test 4: Complete workflow testing
    async testCompleteWorkflow() {
        console.log('\n🔄 Test 4: Complete Workflow Testing');
        console.log('-'.repeat(40));

        const mockCID = {
            cid: "QmTestWorkflow123456789",
            source: "test_runner",
            topicId: "0.0.test123",
            transactionHash: "test@1234567890.123456789",
            timestamp: new Date().toISOString()
        };

        try {
            console.log(`📥 Processing mock CID: ${mockCID.cid}`);
            
            const result = await this.orchestrator.processClaim(mockCID);
            
            console.log('📊 Workflow Results:');
            console.log(`  - CID: ${result.cid}`);
            console.log(`  - Original Text: "${result.originalText.substring(0, 100)}..."`);
            console.log(`  - Claim Type: ${result.structuredData.claimType}`);
            console.log(`  - Confidence: ${(result.structuredData.confidence * 100).toFixed(1)}%`);
            console.log(`  - Processing Time: ${result.metadata.processingTimeMs}ms`);
            
            if (result.evidenceRetrievalPlan) {
                console.log(`  - Evidence Plan Ready: ${result.evidenceRetrievalPlan.readyForPhase3}`);
                console.log(`  - Priority Level: ${result.evidenceRetrievalPlan.priorityLevel}`);
                console.log(`  - Search Queries: ${result.evidenceRetrievalPlan.searchQueries.length}`);
            }

            this.logResult('Complete workflow execution', true);

        } catch (error) {
            console.error('❌ Complete workflow failed:', error);
            this.logResult('Complete workflow execution', false, error.message);
        }
    }

    // Test 5: Various claim types
    async testVariousClaimTypes() {
        console.log('\n🎭 Test 5: Various Claim Types Testing');
        console.log('-'.repeat(40));

        const claimTypes = [
            {
                name: "Medical Claim",
                text: "Clinical trial results show that the new drug reduces symptoms by 80% in patients with chronic pain.",
                expectedFeatures: ['quantified', 'medical_terms', 'high_priority']
            },
            {
                name: "Technology Claim", 
                text: "The AI algorithm processes data 5x faster than traditional machine learning approaches.",
                expectedFeatures: ['quantified', 'comparative', 'technology_terms']
            },
            {
                name: "Environmental Claim",
                text: "Solar panel efficiency has improved significantly with the new photovoltaic technology.",
                expectedFeatures: ['general', 'technology_terms', 'vague_quantifier']
            },
            {
                name: "Economic Claim",
                text: "Company revenues increased by 45% following the implementation of automated systems.",
                expectedFeatures: ['quantified', 'organizational', 'economic_data']
            }
        ];

        for (const [index, claimTest] of claimTypes.entries()) {
            try {
                console.log(`\n📋 Testing ${claimTest.name}:`);
                console.log(`   Text: "${claimTest.text}"`);

                const result = await this.claimParser.parseClaim(claimTest.text);
                const structure = result.structuredClaim;

                console.log(`   📊 Analysis Results:`);
                console.log(`   - Type: ${structure.claimType}`);
                console.log(`   - Confidence: ${(structure.confidence * 100).toFixed(1)}%`);
                console.log(`   - Completeness: ${(structure.qualityMetrics.completeness * 100).toFixed(1)}%`);
                console.log(`   - Specificity: ${(structure.qualityMetrics.specificity * 100).toFixed(1)}%`);
                console.log(`   - Reliability: ${(structure.qualityMetrics.reliability * 100).toFixed(1)}%`);

                // Check for expected features
                let featuresFound = 0;
                if (claimTest.expectedFeatures.includes('quantified') && structure.quantifier) {
                    featuresFound++;
                    console.log(`   ✅ Quantifier detected: ${structure.quantifier}`);
                }
                
                if (claimTest.expectedFeatures.includes('medical_terms') && 
                    structure.entities.medical_terms.length > 0) {
                    featuresFound++;
                    console.log(`   ✅ Medical terms found: ${structure.entities.medical_terms.join(', ')}`);
                }

                if (claimTest.expectedFeatures.includes('technology_terms') && 
                    structure.entities.technologies.length > 0) {
                    featuresFound++;
                    console.log(`   ✅ Technology terms found: ${structure.entities.technologies.join(', ')}`);
                }

                const featureScore = featuresFound / claimTest.expectedFeatures.length;
                this.logResult(`${claimTest.name} analysis`, featureScore > 0.5);

            } catch (error) {
                console.error(`❌ ${claimTest.name} testing failed:`, error);
                this.logResult(`${claimTest.name} analysis`, false, error.message);
            }
        }
    }

    // Log test results
    logResult(testName, success, details = null) {
        this.testResults.push({
            test: testName,
            success,
            details,
            timestamp: new Date().toISOString()
        });
    }

    // Display final test results
    displayTestResults() {
        console.log('\n' + '='.repeat(50));
        console.log('🧪 PHASE 2 TEST RESULTS SUMMARY');
        console.log('='.repeat(50));

        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.success).length;
        const failedTests = totalTests - passedTests;

        console.log(`📊 Overall Results:`);
        console.log(`   Total Tests: ${totalTests}`);
        console.log(`   Passed: ${passedTests} ✅`);
        console.log(`   Failed: ${failedTests} ❌`);
        console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

        if (failedTests > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(r => !r.success)
                .forEach(result => {
                    console.log(`   - ${result.test}: ${result.details || 'Unknown error'}`);
                });
        }

        console.log('\n✅ Passed Tests:');
        this.testResults
            .filter(r => r.success)
            .forEach(result => {
                console.log(`   - ${result.test}`);
            });

        // Get orchestrator stats if available
        if (this.orchestrator) {
            const stats = this.orchestrator.getProcessingStats();
            if (stats.totalProcessed > 0) {
                console.log('\n📈 Processing Statistics:');
                console.log(`   Claims Processed: ${stats.totalProcessed}`);
                console.log(`   Average Confidence: ${stats.averageConfidence}`);
                console.log(`   Ready for Evidence: ${stats.readyForEvidence}`);
                console.log('   Claim Types:', stats.claimTypes);
            }
        }

        console.log('\n🎉 Phase 2 testing completed!');
        
        if (passedTests / totalTests >= 0.8) {
            console.log('🚀 Phase 2 is ready for production!');
        } else {
            console.log('⚠️  Phase 2 needs improvements before production.');
        }
    }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const testRunner = new Phase2TestRunner();
    
    testRunner.runTests().then(() => {
        console.log('\n👋 Test runner completed successfully!');
        process.exit(0);
    }).catch(error => {
        console.error('\n❌ Test runner failed:', error);
        process.exit(1);
    });
}

export default Phase2TestRunner;
