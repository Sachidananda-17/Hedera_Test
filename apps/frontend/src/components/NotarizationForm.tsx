import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Upload, FileText, CheckCircle2, Loader2, Brain, Shield, Globe, Clock, Database, Zap, Eye, Award } from "lucide-react";

export default function NotarizationForm() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!text && !file) return;
    setIsSubmitting(true);
    setProgress(0);

    try {
      // Get account ID from parent component
      const accountId = (window as any).connectedAccountId;
      if (!accountId) {
        throw new Error('No wallet connected');
      }

      // Prepare form data
      const formData = new FormData();
      formData.append('accountId', accountId);
      
      if (file) {
        formData.append('contentType', 'image');
        formData.append('file', file);
      } else {
        formData.append('contentType', 'text');
        formData.append('text', text);
      }

      // Progress simulation while API call is in progress
      let interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 15;
        });
      }, 500);

      // Call the backend API directly
      const response = await fetch('http://localhost:3001/api/notarize', {
        method: 'POST',
        body: formData,
      });

      clearInterval(interval);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to notarize content');
      }

      const result = await response.json();
      
      setResult({
        // Core notarization data
        cid: result.ipfsCid,
        hash: result.hederaTransactionHash || 'No transaction hash',
        ipfsUrl: result.ipfsGatewayUrl,
        ipfsUrls: result.alternativeIPFSUrls || [result.ipfsGatewayUrl],
        hederaExplorerUrl: result.hederaExplorerUrl,
        filebaseUrl: result.filebaseUrl,
        topicId: result.hederaTopicId,
        success: result.success,
        message: result.message,
        timestamp: result.timestamp,
        
        // Enhanced internal processing data
        internalProcessing: result.internalProcessing || {},
        
        // Legacy fields (for backward compatibility)
        ipfsNote: result.ipfsNote || result.internalProcessing?.verificationStatus?.note,
        ipfsWarning: result.ipfsWarning,
        ipfsError: result.errors?.ipfs,
        hederaError: result.errors?.hedera,
        
        // Debug information
        debug: result.debug || {}
      });
      setProgress(100);
      
    } catch (error) {
      console.error('Notarization error:', error);
      setResult({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6">
      <Card className="w-full max-w-2xl shadow-2xl rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Hedera Notary
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* File Upload */}
          <label
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-purple-500 transition"
          >
            <Upload className="w-10 h-10 text-gray-500 mb-2" />
            <span className="text-gray-600">
              {file ? file.name : "Click to upload a file"}
            </span>
            <Input
              id="file-upload"
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {/* Text Input */}
          <div>
            <label className="text-gray-700 font-medium mb-2 block">
              Or enter text
            </label>
            <Textarea
              value={text}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
              placeholder="Enter your text here..."
              className="resize-none focus:ring-2 focus:ring-purple-500"
              rows={4}
            />
          </div>

          {/* Progress Bar */}
          {isSubmitting && (
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-2 bg-gradient-to-r from-blue-500 to-purple-600"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: "easeInOut", duration: 0.3 }}
              />
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-300 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:scale-105 hover:shadow-2xl"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Notarize Now
                </>
              )}
            </Button>
          </div>

          {/* Enhanced Results Display */}
          {result && (
            <motion.div
              className="mt-6 space-y-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {result.error ? (
                /* Error Display */
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Notarization Failed
                    </div>
                    <p className="text-sm text-red-700">{result.error}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Main Success Card */}
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-green-700 font-semibold mb-3">
                        <CheckCircle2 className="w-6 h-6" />
                        Content Successfully Notarized!
                      </div>
                      {result.message && (
                        <p className="text-sm text-green-700 mb-3">{result.message}</p>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="font-semibold text-gray-700">IPFS CID:</span>
                          <div className="font-mono text-blue-600 text-xs break-all mt-1">{result.cid}</div>
                        </div>
                        {result.hash && (
                          <div>
                            <span className="font-semibold text-gray-700">Hedera Transaction:</span>
                            <div className="font-mono text-purple-600 text-xs break-all mt-1">{result.hash}</div>
                          </div>
                        )}
                      </div>
                      {result.timestamp && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                          <Clock className="w-4 h-4" />
                          Notarized at: {new Date(result.timestamp).toLocaleString()}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Internal Processing Status */}
                  {result.internalProcessing && (
                    <Card className="border-blue-200 bg-blue-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Zap className="w-5 h-5 text-blue-600" />
                          Internal Processing Status
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Processing Steps Completed */}
                        {result.debug?.internalStepsCompleted && (
                          <div>
                            <h4 className="font-semibold text-sm text-gray-700 mb-2">✅ Processing Steps Completed:</h4>
                            <div className="flex flex-wrap gap-2">
                              {result.debug.internalStepsCompleted.map((step: string, index: number) => (
                                <span key={index} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-md">
                                  {step.replace(/_/g, ' ').toUpperCase()}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Phase 2 AI Status */}
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                          <div className="flex items-center gap-2">
                            <Brain className={`w-5 h-5 ${result.internalProcessing.phase2Triggered ? 'text-green-600' : 'text-gray-400'}`} />
                            <span className="font-medium">Phase 2 AI Processing</span>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-semibold ${result.internalProcessing.phase2Triggered ? 'text-green-600' : 'text-gray-500'}`}>
                              {result.internalProcessing.phase2Triggered ? '✅ ACTIVE' : '⭕ NOT TRIGGERED'}
                            </div>
                            {result.internalProcessing.phase2Status && (
                              <div className="text-xs text-gray-600">{result.internalProcessing.phase2Status}</div>
                            )}
                          </div>
                        </div>

                        {/* Verification Status */}
                        {result.internalProcessing.verificationStatus && (
                          <div className="p-3 bg-white rounded-lg border">
                            <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              Real-time Verification
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${result.internalProcessing.verificationStatus.ipfsAccessible === true ? 'bg-green-500' : result.internalProcessing.verificationStatus.ipfsAccessible === 'timeout' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                <span>IPFS Access: {result.internalProcessing.verificationStatus.ipfsAccessible === true ? 'Success' : result.internalProcessing.verificationStatus.ipfsAccessible === 'timeout' ? 'Timeout' : 'Failed'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${result.internalProcessing.verificationStatus.hederaRecorded ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span>Hedera: {result.internalProcessing.verificationStatus.hederaRecorded ? 'Recorded' : 'Failed'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${result.internalProcessing.verificationStatus.contentIntegrity ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span>Integrity: {result.internalProcessing.verificationStatus.contentIntegrity ? 'Valid' : 'Invalid'}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Next Steps */}
                        {result.internalProcessing.nextSteps && (
                          <div className="p-3 bg-white rounded-lg border">
                            <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
                              <Eye className="w-4 h-4" />
                              Next Steps
                            </h4>
                            <div className="space-y-1 text-xs text-gray-600">
                              <div>🤖 AI Analysis: {result.internalProcessing.nextSteps.aiAnalysis}</div>
                              <div>🔍 Verification: {result.internalProcessing.nextSteps.verification}</div>
                              <div>📊 Monitoring: {result.internalProcessing.nextSteps.monitoring}</div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Proof Package */}
                  {result.internalProcessing?.proofPackage && (
                    <Card className="border-purple-200 bg-purple-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Award className="w-5 h-5 text-purple-600" />
                          Legal Proof Package
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="font-semibold text-gray-700">Notarization ID:</span>
                            <div className="font-mono text-purple-600 text-xs mt-1">{result.internalProcessing.proofPackage.notarizationId}</div>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700">Content Fingerprint:</span>
                            <div className="font-mono text-blue-600 text-xs mt-1 break-all">{result.internalProcessing.proofPackage.contentFingerprint}</div>
                          </div>
                        </div>
                        
                        {result.internalProcessing.proofPackage.legalAdmissibility && (
                          <div className="p-3 bg-white rounded-lg border">
                            <h4 className="font-semibold text-sm text-gray-700 mb-2">Legal Admissibility Features:</h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {Object.entries(result.internalProcessing.proofPackage.legalAdmissibility).map(([key, value]: [string, any]) => (
                                <div key={key} className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${value ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                  <span>{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Access Links */}
                  <Card className="border-gray-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Globe className="w-5 h-5 text-blue-600" />
                        Access Your Content
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {result.ipfsUrl && (
                        <div>
                          <span className="font-semibold text-sm text-gray-700">Primary IPFS Gateway:</span>
                          <a 
                            href={result.ipfsUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block text-blue-600 hover:underline font-mono text-xs break-all mt-1 p-2 bg-blue-50 rounded"
                          >
                            {result.ipfsUrl}
                          </a>
                        </div>
                      )}
                      
                      {result.hederaExplorerUrl && (
                        <div>
                          <span className="font-semibold text-sm text-gray-700">Blockchain Explorer:</span>
                          <a 
                            href={result.hederaExplorerUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block text-purple-600 hover:underline font-mono text-xs break-all mt-1 p-2 bg-purple-50 rounded"
                          >
                            {result.hederaExplorerUrl}
                          </a>
                        </div>
                      )}

                      {result.ipfsUrls && result.ipfsUrls.length > 1 && (
                        <details className="text-sm text-gray-600">
                          <summary className="cursor-pointer hover:text-gray-800 font-semibold">
                            Alternative IPFS Gateways ({result.ipfsUrls.length - 1} more)
                          </summary>
                          <div className="mt-2 space-y-1">
                            {result.ipfsUrls.slice(1).map((url: string, index: number) => (
                              <a 
                                key={index}
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block text-blue-500 hover:underline font-mono text-xs break-all p-2 bg-gray-50 rounded"
                              >
                                {url}
                              </a>
                            ))}
                          </div>
                        </details>
                      )}
                    </CardContent>
                  </Card>

                  {/* Debug Information */}
                  {result.debug && Object.keys(result.debug).length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer hover:text-gray-800 font-semibold flex items-center gap-2 p-3 bg-gray-50 rounded">
                        <Database className="w-4 h-4" />
                        Debug Information
                      </summary>
                      <Card className="mt-2 border-gray-200 bg-gray-50">
                        <CardContent className="p-3">
                          <pre className="text-xs text-gray-600 overflow-x-auto">
                            {JSON.stringify(result.debug, null, 2)}
                          </pre>
                        </CardContent>
                      </Card>
                    </details>
                  )}

                  {/* Error Messages */}
                  {(result.ipfsError || result.hederaError) && (
                    <Card className="border-yellow-200 bg-yellow-50">
                      <CardContent className="p-3">
                        <h4 className="font-semibold text-sm text-yellow-800 mb-2">⚠️ Warnings</h4>
                        {result.ipfsError && (
                          <p className="text-xs text-yellow-700 mb-1">
                            IPFS: {result.ipfsError}
                          </p>
                        )}
                        {result.hederaError && (
                          <p className="text-xs text-yellow-700">
                            Hedera: {result.hederaError}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
