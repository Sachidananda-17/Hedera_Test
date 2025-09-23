// Staking service for handling stake operations
export interface StakingConfig {
  enabled: boolean;
  appAccountId: string;
  minimumStake: number;
  minimumStakeHbar: number;
  maxStakeAmount: number;
  maxStakeAmountHbar: number;
  serviceTimeout: number;
  autoRefundTimeout: number;
  gracePeriod: number;
}

export interface StakeInfo {
  user: string;
  amount: string;
  timestamp: string;
  status: 'PENDING' | 'COMPLETED' | 'REFUNDED' | 'EXPIRED';
}

export interface StakeResponse {
  success: boolean;
  stake?: {
    success: boolean;
    transactionId: string;
    requestId: string;
    stakeAmount: number;
    status: string;
  };
  timeout?: number;
  message?: string;
  error?: string;
}

class StakingService {
  private baseUrl = 'http://localhost:3001/api';

  async getStakingConfig(): Promise<StakingConfig> {
    try {
      const response = await fetch(`${this.baseUrl}/staking/config`);
      const data = await response.json();
      
      if (data.success) {
        return data.config;
      } else {
        throw new Error(data.message || 'Failed to fetch staking config');
      }
    } catch (error) {
      console.error('Failed to fetch staking config:', error);
      // Return default config if API fails
      return {
        enabled: false,
        appAccountId: '0.0.6884960',
        minimumStake: 50000000,
        minimumStakeHbar: 0.5,
        maxStakeAmount: 1000000000,
        maxStakeAmountHbar: 10,
        serviceTimeout: 3600,
        autoRefundTimeout: 86400,
        gracePeriod: 300
      };
    }
  }

  async getStakingStatus(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/staking/status`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch staking status:', error);
      throw error;
    }
  }

  async createStake(
    requestId: string,
    stakeAmount: number,
    userAccountId: string,
    userPrivateKey: string
  ): Promise<StakeResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/staking/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          stakeAmount,
          userAccountId,
          userPrivateKey
        })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to create stake:', error);
      throw error;
    }
  }

  async getStakeInfo(requestId: string): Promise<StakeInfo> {
    try {
      const response = await fetch(`${this.baseUrl}/staking/stake/${requestId}`);
      const data = await response.json();
      
      if (data.success) {
        return data.stake;
      } else {
        throw new Error(data.message || 'Failed to fetch stake info');
      }
    } catch (error) {
      console.error('Failed to fetch stake info:', error);
      throw error;
    }
  }

  async refundStake(requestId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/staking/refund/${requestId}`, {
        method: 'POST'
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to refund stake:', error);
      throw error;
    }
  }

  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  formatHBAR(tinybars: number): string {
    return `${(tinybars / 100000000).toFixed(2)} HBAR`;
  }

  validateStakeAmount(amount: number, config: StakingConfig): { valid: boolean; error?: string } {
    if (amount < config.minimumStakeHbar) {
      return {
        valid: false,
        error: `Stake amount too low. Minimum: ${config.minimumStakeHbar} HBAR`
      };
    }

    if (amount > config.maxStakeAmountHbar) {
      return {
        valid: false,
        error: `Stake amount too high. Maximum: ${config.maxStakeAmountHbar} HBAR`
      };
    }

    return { valid: true };
  }

  convertHBARToTinybars(hbar: number): number {
    return Math.floor(hbar * 100000000);
  }

  convertTinybarsToHBAR(tinybars: number): number {
    return tinybars / 100000000;
  }
}

export const stakingService = new StakingService();
