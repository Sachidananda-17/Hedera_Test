import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { 
  Lock, 
  Shield, 
  DollarSign, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  Wallet,
  ArrowRight,
  Info
} from "lucide-react";

interface StakingStepProps {
  onStakeCreated: (requestId: string) => void;
  onSkip?: () => void;
  accountId: string;
  privateKey: string;
  stakingConfig: any;
  isRequired: boolean;
}

export const StakingStep: React.FC<StakingStepProps> = ({
  onStakeCreated,
  onSkip,
  accountId,
  privateKey,
  stakingConfig,
  isRequired
}) => {
  const [stakeAmount, setStakeAmount] = useState(stakingConfig?.minimumStakeHbar || 0.5);
  const [isCreatingStake, setIsCreatingStake] = useState(false);
  const [stakeError, setStakeError] = useState('');
  const [currentStep, setCurrentStep] = useState<'configure' | 'creating' | 'success'>('configure');
  const [requestId, setRequestId] = useState('');

  useEffect(() => {
    // Generate unique request ID
    const newRequestId = `stake_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setRequestId(newRequestId);
  }, []);

  const handleCreateStake = async () => {
    if (!accountId || !privateKey) {
      setStakeError('Account credentials are required for staking');
      return;
    }

    setIsCreatingStake(true);
    setStakeError('');
    setCurrentStep('creating');

    try {
      const stakeAmountTinybars = Math.floor(stakeAmount * 100000000); // Convert HBAR to tinybars

      const response = await fetch('/api/staking/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          stakeAmount: stakeAmountTinybars,
          userAccountId: accountId,
          userPrivateKey: privateKey
        })
      });

      const data = await response.json();

      if (data.success) {
        setCurrentStep('success');
        setTimeout(() => {
          onStakeCreated(requestId);
        }, 2000);
      } else {
        throw new Error(data.message || 'Failed to create stake');
      }
    } catch (error) {
      console.error('Staking error:', error);
      setStakeError(error instanceof Error ? error.message : 'Failed to create stake');
      setCurrentStep('configure');
    } finally {
      setIsCreatingStake(false);
    }
  };

  const formatHBAR = (amount: number) => `${amount.toFixed(2)} HBAR`;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <Lock className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">Secure Your Request</h2>
            </div>
            <p className="text-gray-600">
              Stake HBAR to secure your notarization request. Funds are returned on completion.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {currentStep === 'configure' && (
              <motion.div
                key="configure"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {/* Staking Information */}
                <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Info className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-blue-900">How Staking Works</h3>
                  </div>
                  <div className="space-y-2 text-sm text-blue-800">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Stake HBAR to secure your notarization request</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Funds transferred to app on successful completion</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Full refund if service fails or technical issues occur</span>
                    </div>
                  </div>
                </div>

                {/* Stake Configuration */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stake Amount
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        type="number"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(parseFloat(e.target.value) || 0)}
                        min={stakingConfig?.minimumStakeHbar || 0.5}
                        max={stakingConfig?.maxStakeAmountHbar || 10}
                        step={0.1}
                        className="pl-10"
                        placeholder="0.5"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Min: {formatHBAR(stakingConfig?.minimumStakeHbar || 0.5)}</span>
                      <span>Max: {formatHBAR(stakingConfig?.maxStakeAmountHbar || 10)}</span>
                    </div>
                  </div>

                  {/* Configuration Details */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Wallet className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">Account: {accountId.substring(0, 12)}...</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">Timeout: {stakingConfig?.serviceTimeout || 3600}s</span>
                    </div>
                  </div>
                </div>

                {/* Error Display */}
                {stakeError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2"
                  >
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <span className="text-red-700">{stakeError}</span>
                  </motion.div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <Button
                    onClick={handleCreateStake}
                    disabled={isCreatingStake || stakeAmount < (stakingConfig?.minimumStakeHbar || 0.5)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {isCreatingStake ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Creating Stake...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Shield className="h-4 w-4" />
                        <span>Stake {formatHBAR(stakeAmount)}</span>
                      </div>
                    )}
                  </Button>
                  
                  {onSkip && !isRequired && (
                    <Button
                      onClick={onSkip}
                      variant="outline"
                      className="px-6"
                    >
                      Skip
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {currentStep === 'creating' && (
              <motion.div
                key="creating"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center space-y-4 py-8"
              >
                <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Creating Stake</h3>
                <p className="text-gray-600">
                  Processing your stake of {formatHBAR(stakeAmount)}...
                </p>
              </motion.div>
            )}

            {currentStep === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-4 py-8"
              >
                <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Stake Created Successfully!</h3>
                <p className="text-gray-600">
                  Your {formatHBAR(stakeAmount)} stake is now secured. Proceeding to notarization...
                </p>
                <div className="flex items-center justify-center space-x-2 text-sm text-blue-600">
                  <span>Continuing</span>
                  <ArrowRight className="h-4 w-4 animate-pulse" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Request ID Display */}
          {requestId && currentStep !== 'creating' && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Request ID</div>
              <div className="text-sm font-mono text-gray-800 break-all">{requestId}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
