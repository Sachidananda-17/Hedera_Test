import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Upload, FileText, CheckCircle2, Brain, Shield, Globe, Clock, Zap, Award, Sparkles, Cpu } from "lucide-react";

// Typewriter animation component
const TypewriterText = ({ text, delay = 0, speed = 50 }: { text: string; delay?: number; speed?: number }) => {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentIndex < text.length) {
        setDisplayText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }
    }, currentIndex === 0 ? delay : speed);

    return () => clearTimeout(timer);
  }, [currentIndex, text, delay, speed]);

  useEffect(() => {
    setDisplayText("");
    setCurrentIndex(0);
  }, [text]);

  return (
    <span>
      {displayText}
      {currentIndex < text.length && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          className="inline-block"
        >
          |
        </motion.span>
      )}
    </span>
  );
};

// Progressive reveal container
const ProgressiveReveal = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ 
      duration: 0.6, 
      delay,
      type: "spring",
      stiffness: 100,
      damping: 15
    }}
  >
    {children}
  </motion.div>
);

// Pulse animation for processing
const PulseIcon = ({ children, isActive }: { children: React.ReactNode; isActive: boolean }) => (
  <motion.div
    animate={isActive ? {
      scale: [1, 1.2, 1],
      rotateZ: [0, 5, -5, 0]
    } : {}}
    transition={{ 
      duration: 2, 
      repeat: isActive ? Infinity : 0,
      ease: "easeInOut"
    }}
  >
    {children}
  </motion.div>
);

export default function NotarizationForm() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!text && !file) return;
    setIsSubmitting(true);
    setProgress(0);
    setShowResult(false);
    setResult(null);

    // Processing stages for animated feedback
    const stages = [
      "🚀 Initializing notarization process...",
      "🔐 Validating content and credentials...",
      "🧮 Generating cryptographic fingerprint...",
      "📡 Uploading to decentralized storage...",
      "⛓️ Recording on Hedera blockchain...",
      "🤖 Triggering AI analysis pipeline...",
      "🔍 Performing real-time verification...",
      "📋 Generating legal proof package...",
      "✅ Finalizing notarization..."
    ];

    let stageIndex = 0;
    const progressStages = () => {
      if (stageIndex < stages.length) {
        setProcessingStage(stages[stageIndex]);
        stageIndex++;
        setTimeout(progressStages, 800);
      }
    };

    try {
      // Start stage progression
      progressStages();

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
        formData.append('title', 'Uploaded Document');
        formData.append('tags', 'document,notarization');
      } else {
        formData.append('contentType', 'text');
        formData.append('text', text);
        formData.append('title', 'Text Content');
        formData.append('tags', 'text,notarization');
      }

      // Smooth progress animation
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        setProgress(progress);
      }, 400);

      // Call the backend API directly
      const response = await fetch('http://localhost:3001/api/notarize', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to notarize content');
      }

      const result = await response.json();
      
      // Simulate final processing stage
      setProcessingStage("🎉 Notarization completed successfully!");
      
      setTimeout(() => {
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
        
        setShowResult(true);
      }, 1000);
      
    } catch (error) {
      console.error('Notarization error:', error);
      setProcessingStage("❌ Notarization failed");
      
      setTimeout(() => {
      setResult({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
        setShowResult(true);
      }, 1000);
    } finally {
      setTimeout(() => {
      setIsSubmitting(false);
        setProcessingStage("");
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="w-full space-y-6">
        
        {/* Header with animated title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="text-center py-8"
        >
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
            <PulseIcon isActive={true}>
              <Sparkles className="inline-block w-8 h-8 mr-2" />
            </PulseIcon>
            Hedera AI Notary
          </h1>
          <TypewriterText 
            text="Decentralized content verification with AI-powered analysis" 
            speed={30}
            delay={500}
          />
        </motion.div>

        {/* Input Section - Full Width ChatGPT Style */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full max-w-6xl mx-auto"
        >
          <Card className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">
            <CardContent className="p-8 space-y-8">
              
              {/* File Upload and Text Input - Side by Side Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* File Upload - Modern Design */}
                <motion.label
                  htmlFor="file-upload"
                  className="relative group"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-purple-300/50 rounded-2xl p-8 cursor-pointer transition-all duration-300 group-hover:border-purple-400 group-hover:bg-purple-50/5 h-48">
                    <motion.div
                      animate={file ? { rotate: 360 } : { rotate: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Upload className="w-12 h-12 text-purple-400 mb-3" />
                    </motion.div>
                    <span className="text-white/80 text-lg font-medium">
                      {file ? (
                        <TypewriterText text={`✅ ${file.name}`} speed={30} />
                      ) : (
                        "Click to upload a file"
                      )}
                    </span>
                    <span className="text-white/50 text-sm mt-2">
                      Documents, images, any file type
            </span>
            <Input
              id="file-upload"
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
                  </div>
                </motion.label>

                {/* Text Input - Enhanced */}
                <div className="space-y-3">
                  <label className="text-white/90 font-medium text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Or enter text to notarize
            </label>
                  <motion.div
                    whileFocus={{ scale: 1.01 }}
                    transition={{ duration: 0.2 }}
                  >
            <Textarea
              value={text}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
                      placeholder="Type your content here... contracts, agreements, important text, anything you want to notarize on the blockchain..."
                      className="resize-none bg-white/10 border-white/20 text-white placeholder:text-white/50 text-lg p-4 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all duration-300 h-48"
                      rows={6}
                    />
                  </motion.div>
          </div>

              </div>

              {/* Submit Button - Floating Action Style */}
              <div className="flex justify-center pt-4">
              <motion.div
                  whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(139, 92, 246, 0.3)" }}
                  whileTap={{ scale: 0.95 }}
                >
            <Button
              onClick={handleSubmit}
                    disabled={isSubmitting || (!text && !file)}
                    className="px-8 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white shadow-2xl border-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isSubmitting ? (
                <>
                        <PulseIcon isActive={true}>
                          <Cpu className="w-6 h-6" />
                        </PulseIcon>
                        <TypewriterText text="Processing..." speed={100} />
                </>
              ) : (
                <>
                        <Sparkles className="w-6 h-6" />
                        Notarize with AI
                </>
              )}
            </Button>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Processing Stage Display - Full Width ChatGPT Style */}
        <AnimatePresence>
          {isSubmitting && processingStage && (
            <ProgressiveReveal delay={0.1}>
              <div className="w-full max-w-6xl mx-auto">
                <Card className="bg-blue-500/10 backdrop-blur-xl border border-blue-400/30 shadow-2xl">
                  <CardContent className="p-8">
                    <div className="flex items-center gap-4">
                      <PulseIcon isActive={true}>
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                          <Cpu className="w-5 h-5 text-white" />
                        </div>
                      </PulseIcon>
                      <div className="flex-1">
                        <TypewriterText 
                          text={processingStage} 
                          speed={50} 
                          delay={0}
                        />
                        <div className="mt-3 w-full bg-white/20 rounded-full h-2 overflow-hidden">
                          <motion.div
                            className="h-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-full"
                            initial={{ width: "0%" }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
          </div>
            </ProgressiveReveal>
          )}
        </AnimatePresence>

        {/* Results Display - Full Width ChatGPT Conversation Style */}
        <AnimatePresence>
          {showResult && result && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full space-y-6"
            >
              {result.error ? (
                /* Error Chat Bubble */
                <ProgressiveReveal delay={0.2}>
                  <div className="w-full max-w-6xl mx-auto">
                    <Card className="bg-red-500/10 backdrop-blur-xl border border-red-400/30 shadow-2xl">
                      <CardContent className="p-8">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                            <Zap className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-red-400 mb-3">
                              <TypewriterText text="❌ Notarization Failed" speed={50} />
                            </h3>
                            <div className="text-white/80">
                              <TypewriterText text={result.error} speed={30} delay={500} />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </ProgressiveReveal>
              ) : (
                <div className="space-y-6">
                  
                  {/* Success Chat Bubble */}
                  <ProgressiveReveal delay={0.2}>
                    <div className="w-full max-w-6xl mx-auto">
                      <Card className="bg-green-500/10 backdrop-blur-xl border border-green-400/30 shadow-2xl">
                        <CardContent className="p-8">
                        <div className="flex items-start gap-4">
                          <motion.div 
                            className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, delay: 1 }}
                          >
                            <CheckCircle2 className="w-6 h-6 text-white" />
                          </motion.div>
                          <div className="flex-1">
                            <h3 className="text-2xl font-bold text-green-400 mb-3">
                              <TypewriterText text="🎉 Content Successfully Notarized!" speed={60} />
                            </h3>
                            <div className="text-white/90 text-lg mb-4">
                              <TypewriterText 
                                text={result.message || "Your content is now permanently recorded on the blockchain with cryptographic proof of existence and authenticity."} 
                                speed={25} 
                                delay={1000} 
                              />
                            </div>
                            
                            {/* Core Data Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                              <motion.div 
                                className="bg-white/10 rounded-xl p-4 border border-white/20"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 2, duration: 0.6 }}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <Globe className="w-5 h-5 text-blue-400" />
                                  <span className="font-semibold text-white/90">IPFS CID</span>
                                </div>
                                <div className="font-mono text-blue-300 text-sm break-all">
                                  <TypewriterText text={result.cid} speed={20} delay={2200} />
                                </div>
                              </motion.div>
                              
                              {result.hash && (
                                <motion.div 
                                  className="bg-white/10 rounded-xl p-4 border border-white/20"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 2.3, duration: 0.6 }}
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <Zap className="w-5 h-5 text-purple-400" />
                                    <span className="font-semibold text-white/90">Blockchain TX</span>
                                  </div>
                                  <div className="font-mono text-purple-300 text-sm break-all">
                                    <TypewriterText text={result.hash} speed={20} delay={2500} />
                                  </div>
                                </motion.div>
                              )}
                            </div>
                            
                            {result.timestamp && (
                              <motion.div 
                                className="flex items-center gap-2 mt-4 text-white/70"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 3, duration: 0.6 }}
                              >
                                <Clock className="w-4 h-4" />
                                <TypewriterText 
                                  text={`Notarized on ${new Date(result.timestamp).toLocaleString()}`} 
                                  speed={30} 
                                  delay={3200} 
                                />
                              </motion.div>
                            )}
                          </div>
                        </div>
                        </CardContent>
                      </Card>
                    </div>
                  </ProgressiveReveal>

                  {/* AI Processing Status */}
                  {result.internalProcessing && (
                    <ProgressiveReveal delay={0.5}>
                      <div className="w-full max-w-6xl mx-auto">
                        <Card className="bg-blue-500/10 backdrop-blur-xl border border-blue-400/30 shadow-2xl">
                          <CardContent className="p-8">
                          <div className="flex items-start gap-4">
                            <PulseIcon isActive={result.internalProcessing.phase2Triggered}>
                              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                <Brain className="w-6 h-6 text-white" />
                              </div>
                            </PulseIcon>
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-blue-400 mb-3">
                                <TypewriterText text="🤖 AI Processing Analysis" speed={50} delay={0} />
                              </h3>
                              
                              {/* Processing Steps */}
                              {result.debug?.internalStepsCompleted && (
                                <div className="mb-4">
                                  <div className="text-white/70 mb-2">
                                    <TypewriterText text="Completed processing steps:" speed={30} delay={500} />
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {result.debug.internalStepsCompleted.map((step: string, index: number) => (
                                      <motion.span 
                                        key={index}
                                        className="px-3 py-1 bg-green-500/20 text-green-300 text-sm rounded-full border border-green-400/30"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.8 + index * 0.1, duration: 0.3 }}
                                      >
                                        {step.replace(/_/g, ' ').toUpperCase()}
                                      </motion.span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* AI Status */}
                              <motion.div 
                                className="bg-white/10 rounded-xl p-4 border border-white/20"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.2, duration: 0.6 }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Brain className={`w-6 h-6 ${result.internalProcessing.phase2Triggered ? 'text-green-400' : 'text-gray-400'}`} />
                                    <span className="font-semibold text-white/90">Phase 2 AI Processing</span>
                                  </div>
                                  <div className="text-right">
                                    <div className={`font-bold text-sm ${result.internalProcessing.phase2Triggered ? 'text-green-400' : 'text-gray-500'}`}>
                                      <TypewriterText 
                                        text={result.internalProcessing.phase2Triggered ? '✅ ACTIVE' : '⭕ NOT TRIGGERED'} 
                                        speed={50} 
                                        delay={1400} 
                                      />
                                    </div>
                                    {result.internalProcessing.phase2Status && (
                                      <div className="text-xs text-white/60 mt-1">
                                        <TypewriterText text={result.internalProcessing.phase2Status} speed={30} delay={1800} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>

                              {/* Verification Status */}
                              {result.internalProcessing.verificationStatus && (
                                <motion.div 
                                  className="bg-white/10 rounded-xl p-4 border border-white/20 mt-4"
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 1.5, duration: 0.6 }}
                                >
                                  <h4 className="flex items-center gap-2 font-semibold text-white/90 mb-3">
                                    <Shield className="w-5 h-5" />
                                    <TypewriterText text="Real-time Verification" speed={40} delay={1700} />
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <motion.div 
                                      className="flex items-center gap-2"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      transition={{ delay: 2, duration: 0.4 }}
                                    >
                                      <div className={`w-3 h-3 rounded-full ${result.internalProcessing.verificationStatus.ipfsAccessible === true ? 'bg-green-400' : result.internalProcessing.verificationStatus.ipfsAccessible === 'timeout' ? 'bg-yellow-400' : 'bg-red-400'}`}></div>
                                      <span className="text-white/80 text-sm">
                                        IPFS: {result.internalProcessing.verificationStatus.ipfsAccessible === true ? 'Success' : result.internalProcessing.verificationStatus.ipfsAccessible === 'timeout' ? 'Timeout' : 'Failed'}
                                      </span>
                                    </motion.div>
                                    <motion.div 
                                      className="flex items-center gap-2"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      transition={{ delay: 2.2, duration: 0.4 }}
                                    >
                                      <div className={`w-3 h-3 rounded-full ${result.internalProcessing.verificationStatus.hederaRecorded ? 'bg-green-400' : 'bg-red-400'}`}></div>
                                      <span className="text-white/80 text-sm">
                                        Hedera: {result.internalProcessing.verificationStatus.hederaRecorded ? 'Recorded' : 'Failed'}
                                      </span>
                                    </motion.div>
                                    <motion.div 
                                      className="flex items-center gap-2"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      transition={{ delay: 2.4, duration: 0.4 }}
                                    >
                                      <div className={`w-3 h-3 rounded-full ${result.internalProcessing.verificationStatus.contentIntegrity ? 'bg-green-400' : 'bg-red-400'}`}></div>
                                      <span className="text-white/80 text-sm">
                                        Integrity: {result.internalProcessing.verificationStatus.contentIntegrity ? 'Valid' : 'Invalid'}
                                      </span>
                                    </motion.div>
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          </div>
                          </CardContent>
                        </Card>
                      </div>
                    </ProgressiveReveal>
                  )}

                  {/* Legal Proof Package */}
                  {result.internalProcessing?.proofPackage && (
                    <ProgressiveReveal delay={0.8}>
                      <div className="w-full max-w-6xl mx-auto">
                        <Card className="bg-purple-500/10 backdrop-blur-xl border border-purple-400/30 shadow-2xl">
                          <CardContent className="p-8">
                          <div className="flex items-start gap-4">
                            <motion.div 
                              className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0"
                              animate={{ rotateY: 360 }}
                              transition={{ duration: 2, delay: 1 }}
                            >
                              <Award className="w-6 h-6 text-white" />
                            </motion.div>
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-purple-400 mb-3">
                                <TypewriterText text="🏆 Legal Proof Package Generated" speed={50} />
                              </h3>
                              <div className="text-white/80 mb-4">
                                <TypewriterText 
                                  text="Your content now has legally admissible proof of existence, integrity, and timestamp." 
                                  speed={25} 
                                  delay={800} 
                                />
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <motion.div 
                                  className="bg-white/10 rounded-xl p-4 border border-white/20"
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 1.5, duration: 0.6 }}
                                >
                                  <div className="text-sm text-white/70 mb-1">Notarization ID:</div>
                                  <div className="font-mono text-purple-300 text-xs">
                                    <TypewriterText text={result.internalProcessing.proofPackage.notarizationId} speed={15} delay={1700} />
                                  </div>
                                </motion.div>
                                
                                <motion.div 
                                  className="bg-white/10 rounded-xl p-4 border border-white/20"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 1.8, duration: 0.6 }}
                                >
                                  <div className="text-sm text-white/70 mb-1">Content Fingerprint:</div>
                                  <div className="font-mono text-blue-300 text-xs break-all">
                                    <TypewriterText text={result.internalProcessing.proofPackage.contentFingerprint} speed={15} delay={2000} />
                                  </div>
                                </motion.div>
                              </div>

                              {/* Legal Features */}
                              {result.internalProcessing.proofPackage.legalAdmissibility && (
                                <motion.div 
                                  className="bg-white/10 rounded-xl p-4 border border-white/20 mt-4"
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 2.3, duration: 0.6 }}
                                >
                                  <h4 className="font-semibold text-white/90 mb-3">
                                    <TypewriterText text="⚖️ Legal Admissibility Features:" speed={40} delay={2500} />
                                  </h4>
                                  <div className="grid grid-cols-2 gap-3">
                                    {Object.entries(result.internalProcessing.proofPackage.legalAdmissibility).map(([key, value]: [string, any], index: number) => (
                                      <motion.div 
                                        key={key} 
                                        className="flex items-center gap-2"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 2.8 + index * 0.2, duration: 0.4 }}
                                      >
                                        <div className={`w-3 h-3 rounded-full ${value ? 'bg-green-400' : 'bg-red-400'}`}></div>
                                        <span className="text-white/80 text-sm capitalize">
                                          {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                        </span>
                                      </motion.div>
                                    ))}
                                  </div>
                                </motion.div>
                        )}
                            </div>
                          </div>
                          </CardContent>
                        </Card>
                      </div>
                    </ProgressiveReveal>
                  )}

                  {/* Access Links */}
                  <ProgressiveReveal delay={1.1}>
                    <div className="w-full max-w-6xl mx-auto">
                      <Card className="bg-white/5 backdrop-blur-xl border border-white/20 shadow-2xl">
                        <CardContent className="p-8">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <Globe className="w-6 h-6 text-white" />
                  </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-blue-400 mb-3">
                              <TypewriterText text="🌐 Access Your Content" speed={50} />
                            </h3>
                            
                            {result.ipfsUrl && (
                              <motion.div 
                                className="mb-4"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.8, duration: 0.6 }}
                              >
                                <div className="text-white/70 mb-2">Primary IPFS Gateway:</div>
                                <motion.a 
                                  href={result.ipfsUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="block bg-blue-500/20 text-blue-300 hover:text-blue-200 font-mono text-sm break-all p-3 rounded-xl border border-blue-400/30 hover:border-blue-400/50 transition-all duration-300"
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                >
                                  <TypewriterText text={result.ipfsUrl} speed={10} delay={1000} />
                                </motion.a>
                              </motion.div>
                            )}
                            
                            {result.hederaExplorerUrl && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.2, duration: 0.6 }}
                              >
                                <div className="text-white/70 mb-2">Blockchain Explorer:</div>
                                <motion.a 
                                  href={result.hederaExplorerUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="block bg-purple-500/20 text-purple-300 hover:text-purple-200 font-mono text-sm break-all p-3 rounded-xl border border-purple-400/30 hover:border-purple-400/50 transition-all duration-300"
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                >
                                  <TypewriterText text={result.hederaExplorerUrl} speed={10} delay={1400} />
                                </motion.a>
                              </motion.div>
                            )}
                          </div>
                        </div>
                        </CardContent>
                      </Card>
                    </div>
                  </ProgressiveReveal>

                  {/* Warnings/Errors */}
                  {(result.ipfsError || result.hederaError) && (
                    <ProgressiveReveal delay={1.4}>
                      <div className="w-full max-w-6xl mx-auto">
                        <Card className="bg-yellow-500/10 backdrop-blur-xl border border-yellow-400/30 shadow-2xl">
                          <CardContent className="p-8">
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
                              <Zap className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-yellow-400 mb-3">
                                <TypewriterText text="⚠️ System Notices" speed={50} />
                              </h3>
                      {result.ipfsError && (
                                <div className="text-yellow-200 mb-2">
                                  <span className="font-semibold">IPFS: </span>
                                  <TypewriterText text={result.ipfsError} speed={25} delay={500} />
                                </div>
                      )}
                      {result.hederaError && (
                                <div className="text-yellow-200">
                                  <span className="font-semibold">Hedera: </span>
                                  <TypewriterText text={result.hederaError} speed={25} delay={800} />
                                </div>
                      )}
                            </div>
                          </div>
                          </CardContent>
                        </Card>
                      </div>
                    </ProgressiveReveal>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
