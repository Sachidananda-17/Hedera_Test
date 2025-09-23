import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TransferTransaction, AccountId, Hbar } from "@hashgraph/sdk";
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { treasuryConfig } from '../config/treasury';
import { Shield, RefreshCcw, Wallet, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';

export const StakingPanel: React.FC = () => {
    const [stakeAmount, setStakeAmount] = useState<number>(5);
    const [treasuryBalance, setTreasuryBalance] = useState<string>('10');
    const [userBalance, setUserBalance] = useState<string>('0');
    const [userBalanceUsd, setUserBalanceUsd] = useState<string>('0');
    const [isStaking, setIsStaking] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [userStakeStatus, setUserStakeStatus] = useState<{
        isStaked: boolean;
        amount: number;
    }>({ isStaked: false, amount: 0 });

    const fetchBalances = async () => {
        try {
            setIsRefreshing(true);
            const provider = (window as any).hashConnect.getProvider('testnet', treasuryConfig.accountId, null);
            
            // Get treasury balance
            const treasuryBalanceHbar = await provider.getAccountBalance(treasuryConfig.accountId);
            setTreasuryBalance(treasuryBalanceHbar.toString());

            // Get user balance if connected
            if ((window as any).connectedAccountId) {
                try {
                    // Get HBAR balance
                    const userBalanceHbar = await provider.getAccountBalance((window as any).connectedAccountId);
                    console.log('User HBAR Balance:', userBalanceHbar);
                    setUserBalance(userBalanceHbar.toString());

                    // Get USD value (assuming 1 HBAR = $0.217 based on your wallet screenshot)
                    const usdValue = Number(userBalanceHbar) * 0.217;
                    setUserBalanceUsd(usdValue.toFixed(2));
                } catch (balanceError) {
                    console.error('Error fetching user balance:', balanceError);
                }
            }

            // Verify stake status
            try {
                const transactions = await provider.getAccountTransactions((window as any).connectedAccountId);
                console.log('User Transactions:', transactions);
                
                const stakeTransaction = transactions?.find(tx => 
                    tx.type === 'CRYPTO_TRANSFER' && 
                    tx.transfers?.some(transfer => 
                        transfer.to === treasuryConfig.accountId && 
                        transfer.amount >= treasuryConfig.minimumStake
                    )
                );

                if (stakeTransaction) {
                    const stakeAmount = stakeTransaction.transfers.find(
                        t => t.to === treasuryConfig.accountId
                    )?.amount || 0;
                    
                    setUserStakeStatus({
                        isStaked: true,
                        amount: stakeAmount
                    });
                }
            } catch (txError) {
                console.error('Error checking stake status:', txError);
            }
        } catch (error) {
            console.error('Error in fetchBalances:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchBalances();
        const interval = setInterval(fetchBalances, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleStake = async () => {
        // Convert HBAR amounts to proper format
        const userBalanceHbar = Number(userBalance);
        console.log('Attempting to stake:', stakeAmount, 'HBAR');
        console.log('User balance:', userBalanceHbar, 'HBAR');

        if (stakeAmount > userBalanceHbar) {
            alert('Insufficient balance for staking');
            return;
        }

        try {
            setIsStaking(true);
            console.log('Creating transaction for account:', (window as any).connectedAccountId);
            
            const transferTransaction = new TransferTransaction()
                .addHbarTransfer((window as any).connectedAccountId, new Hbar(-stakeAmount))
                .addHbarTransfer(treasuryConfig.accountId, new Hbar(stakeAmount))
                .setTransactionMemo("Altheia Platform Stake");

            console.log('Sending transaction...');
            const result = await (window as any).hashConnect.sendTransaction(
                transferTransaction,
                'Stake HBAR to Altheia Platform'
            );

            console.log('Transaction result:', result);

            if (result.success) {
                setUserStakeStatus({
                    isStaked: true,
                    amount: stakeAmount
                });
                await fetchBalances();
                alert(`Successfully staked ${stakeAmount} HBAR`);
            }
        } catch (error) {
            console.error('Staking error:', error);
            alert(`Staking failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsStaking(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Staking Dashboard</h2>
                <Button
                    onClick={fetchBalances}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white"
                    disabled={isRefreshing}
                >
                    <RefreshCcw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Treasury Info */}
                <Card className="bg-black/30 backdrop-blur-xl border-purple-500/20">
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-purple-600/20 rounded-lg">
                                <Shield className="w-6 h-6 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Treasury Status</h3>
                                <p className="text-gray-400 text-sm">Current pool information</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-white/5 rounded-lg p-4">
                                <div className="text-sm text-gray-400 mb-1">Total Balance</div>
                                <div className="text-2xl font-bold text-white">{treasuryBalance} ℏ</div>
                            </div>

                            <div className="bg-white/5 rounded-lg p-4">
                                <div className="text-sm text-gray-400 mb-1">Minimum Stake</div>
                                <div className="text-2xl font-bold text-white">{treasuryConfig.minimumStake} ℏ</div>
                            </div>

                            <div className="text-sm text-gray-400">
                                Treasury ID: {treasuryConfig.accountId}
                                <a
                                    href={`https://hashscan.io/testnet/account/${treasuryConfig.accountId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-purple-400 hover:text-purple-300 ml-2 inline-flex items-center"
                                >
                                    View on HashScan
                                    <ArrowRight className="w-3 h-3 ml-1" />
                                </a>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Staking Interface */}
                <Card className="bg-black/30 backdrop-blur-xl border-purple-500/20">
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-purple-600/20 rounded-lg">
                                <Wallet className="w-6 h-6 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Your Stake</h3>
                                <p className="text-gray-400 text-sm">Manage your stake</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-white/5 rounded-lg p-4">
                                <div className="text-sm text-gray-400 mb-1">Your Balance</div>
                                <div className="text-2xl font-bold text-white">
                                    {userBalance} ℏ
                                    <span className="text-sm text-gray-400 ml-2">(${userBalanceUsd})</span>
                                </div>
                            </div>

                            {Number(userBalance) < treasuryConfig.minimumStake && (
                                <div className="flex items-center gap-2 text-yellow-500 bg-yellow-500/10 p-3 rounded-lg">
                                    <AlertCircle className="w-5 h-5" />
                                    <span className="text-sm">Insufficient balance for minimum stake</span>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">
                                    Stake Amount (min {treasuryConfig.minimumStake} HBAR)
                                </label>
                                <Input
                                    type="number"
                                    value={stakeAmount}
                                    onChange={(e) => setStakeAmount(Number(e.target.value))}
                                    min={treasuryConfig.minimumStake}
                                    max={Number(userBalance)}
                                    className="bg-white/5 border-white/10 text-white"
                                    placeholder="Enter amount to stake"
                                />
                            </div>

                            <Button
                                onClick={handleStake}
                                disabled={isStaking || stakeAmount < treasuryConfig.minimumStake || stakeAmount > Number(userBalance)}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 transition-all"
                            >
                                {isStaking ? (
                                    <div className="flex items-center">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                        Processing...
                                    </div>
                                ) : (
                                    `Stake ${stakeAmount} HBAR`
                                )}
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Stake Status */}
            {userStakeStatus.isStaked && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-500/10 border border-green-500/20 rounded-lg p-6"
                >
                    <div className="flex items-center gap-3">
                        <CheckCircle className="w-6 h-6 text-green-400" />
                        <div>
                            <h3 className="text-lg font-semibold text-white">Stake Active</h3>
                            <p className="text-gray-400">
                                You have successfully staked {userStakeStatus.amount} HBAR
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
};