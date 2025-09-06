import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, CheckCircle2, Loader2 } from "lucide-react";

export default function NotaryUI() {
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

      // Call the real backend API
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
        cid: result.ipfsCid,
        hash: result.hederaTransactionHash || 'No transaction hash',
        ipfsUrl: result.ipfsGatewayUrl,
        topicId: result.hederaTopicId,
        success: result.success
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

          {/* Results */}
          {result && (
            <motion.div
              className={`mt-6 p-4 rounded-xl shadow-md ${
                result.error 
                  ? 'bg-red-50 border border-red-200' 
                  : 'bg-green-50 border border-green-200'
              }`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {result.error ? (
                <>
                  <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Notarization Failed
                  </div>
                  <p className="text-sm text-red-700">
                    {result.error}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-green-700 font-semibold mb-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Notarization Successful
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">IPFS CID:</span>{' '}
                      <span className="font-mono text-blue-600">{result.cid}</span>
                    </p>
                    {result.hash && (
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">Hedera TX Hash:</span>{' '}
                        <span className="font-mono text-purple-600">{result.hash}</span>
                      </p>
                    )}
                    {result.topicId && (
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">HCS Topic ID:</span>{' '}
                        <span className="font-mono text-green-600">{result.topicId}</span>
                      </p>
                    )}
                    {result.ipfsUrl && (
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">IPFS URL:</span>{' '}
                        <a 
                          href={result.ipfsUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline font-mono text-xs break-all"
                        >
                          {result.ipfsUrl}
                        </a>
                      </p>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
