import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Upload, FileText, CheckCircle2, Brain, Shield, Clock, Zap } from "lucide-react";
import { treasuryConfig } from "../config/treasury";
import { sha256 } from 'multiformats/hashes/sha2';
import * as raw from 'multiformats/codecs/raw';
import { CID } from 'multiformats/cid';

async function generateContentHash(content: File | string): Promise<string> {
  let contentBuffer: Buffer;
  if (typeof content === 'string') {
    contentBuffer = Buffer.from(content, 'utf8');
  } else {
    contentBuffer = Buffer.from(await content.arrayBuffer());
  }
  const hash = await sha256.digest(contentBuffer);
  const cid = CID.createV1(raw.code, hash);
  return cid.toString();
}

interface NotarizationFormProps {
  accountBalance: string;
  onMint: (contentHash: string) => Promise<string>;
  onNotarize: (contentHash: string) => Promise<string>;
  connectedAccountId: string;
}

export function NotarizationForm({ 
  accountBalance, 
  onMint, 
  onNotarize, 
  connectedAccountId 
}: NotarizationFormProps) {
  const [content, setContent] = useState<File | string | null>(null);
  const [contentType, setContentType] = useState<'text' | 'file' | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [isNotarizing, setIsNotarizing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: Upload, 2: Mint, 3: Notarize
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);
  const [notarizeTxHash, setNotarizeTxHash] = useState<string | null>(null);
  const [contentHash, setContentHash] = useState<string | null>(null);

  const handleMintClick = async () => {
    if (!content) {
      alert("Please provide content to mint.");
      return;
    }
    if (Number(accountBalance) < treasuryConfig.minimumStake) {
      alert(`Insufficient balance. Minimum ${treasuryConfig.minimumStake} HBAR required for minting.`);
      return;
    }

    try {
      setIsMinting(true);
      const hash = await generateContentHash(content);
      setContentHash(hash);
      const txHash = await onMint(hash);
      setMintTxHash(txHash);
      setCurrentStep(3);
    } catch (error) {
      alert(`Minting failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsMinting(false);
    }
  };

  const handleNotarizeClick = async () => {
    if (!contentHash) {
      alert("Please mint content first.");
      return;
    }
    try {
      setIsNotarizing(true);
      const txHash = await onNotarize(contentHash);
      setNotarizeTxHash(txHash);
      alert("Notarization successful!");
    } catch (error) {
      alert(`Notarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsNotarizing(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8 text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Content Notarization</h1>
        <p className="text-white/70">Secure your content on Hedera network</p>
      </div>

      {/* Step Indicator */}
      <div className="max-w-6xl mx-auto flex justify-between items-center text-white/70 mb-8">
        <div className={`flex items-center ${currentStep >= 1 ? 'text-purple-400' : ''}`}>
          <Upload className="w-5 h-5 mr-2" />
          <span>Upload</span>
        </div>
        <div className={`flex items-center ${currentStep >= 2 ? 'text-purple-400' : ''}`}>
          <Brain className="w-5 h-5 mr-2" />
          <span>Mint</span>
        </div>
        <div className={`flex items-center ${currentStep >= 3 ? 'text-purple-400' : ''}`}>
          <Shield className="w-5 h-5 mr-2" />
          <span>Notarize</span>
        </div>
      </div>

      {/* Balance Display */}
      <div className="max-w-6xl mx-auto mb-8">
        <Card className="bg-white/5 backdrop-blur-sm border-white/10">
          <CardContent className="p-4 flex justify-between items-center">
            <div className="text-white/70">Your Balance:</div>
            <div className="text-white font-mono">{accountBalance} ℏ</div>
          </CardContent>
        </Card>
      </div>

      {/* Content Upload */}
      <div className="max-w-6xl mx-auto mb-8">
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* File Upload */}
              <motion.label
                htmlFor="file-upload"
                className="relative cursor-pointer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-purple-300/50 rounded-xl p-8 transition-all duration-300 hover:border-purple-400 hover:bg-purple-400/5">
                  <Upload className="w-12 h-12 text-purple-400 mb-3" />
                  <span className="text-white/80 text-lg font-medium">
                    {content && typeof content !== 'string' ? content.name : "Click to upload a file"}
                  </span>
                  <span className="text-white/50 text-sm mt-2">Supports any file type</span>
                  <Input
                    id="file-upload"
                    type="file"
                    onChange={(e) => {
                      if (e.target.files) {
                        setContent(e.target.files[0]);
                        setContentType('file');
                        setCurrentStep(2);
                      }
                    }}
                    className="hidden"
                  />
                </div>
              </motion.label>

              {/* Text Input */}
              <div className="space-y-3">
                <label className="text-white/90 font-medium flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Or enter text to notarize
                </label>
                <Textarea
                  value={typeof content === 'string' ? content : ''}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setContentType('text');
                    setCurrentStep(2);
                  }}
                  placeholder="Type your content here..."
                  className="h-[200px] bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 space-y-4">
              <Button
                onClick={handleMintClick}
                disabled={isMinting || !content || currentStep < 2}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-6 text-lg"
              >
                {isMinting ? (
                  <div className="flex items-center">
                    <Clock className="animate-spin mr-2" />
                    Minting...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Zap className="mr-2" />
                    Mint Content ({treasuryConfig.minimumStake} ℏ)
                  </div>
                )}
              </Button>

              <Button
                onClick={handleNotarizeClick}
                disabled={isNotarizing || !mintTxHash || currentStep < 3}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-6 text-lg"
              >
                {isNotarizing ? (
                  <div className="flex items-center">
                    <Clock className="animate-spin mr-2" />
                    Notarizing...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Shield className="mr-2" />
                    Notarize Content
                  </div>
                )}
              </Button>
            </div>

            {/* Transaction Links */}
            {mintTxHash && (
              <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center text-green-400">
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  <span>
                    Minting Transaction:{" "}
                    <a
                      href={`https://hashscan.io/testnet/transaction/${mintTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      View on HashScan
                    </a>
                  </span>
                </div>
              </div>
            )}

            {notarizeTxHash && (
              <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center text-green-400">
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  <span>
                    Notarization Transaction:{" "}
                    <a
                      href={`https://hashscan.io/testnet/transaction/${notarizeTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      View on HashScan
                    </a>
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}