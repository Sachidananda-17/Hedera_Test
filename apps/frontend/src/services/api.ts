/**
 * Unified API Service for Frontend
 * Handles all communication with the backend
 */

import type { 
  NotarizationRequest, 
  NotarizationResponse, 
  HealthCheckResponse,
  Phase2StatusResponse,
  ProcessedClaim,
  ApiResponse 
} from '../../../packages/shared/types/index';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * API Service Class
 */
export class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Generic fetch wrapper with error handling
   */
  private async fetchApi<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        data,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Fetch wrapper for FormData requests
   */
  private async fetchFormData<T>(
    endpoint: string,
    formData: FormData
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        data,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      };
    }
  }

  // ============================================================================
  // Phase 1: Content Notarization APIs
  // ============================================================================

  /**
   * Submit content for notarization
   */
  async notarizeContent(request: NotarizationRequest): Promise<ApiResponse<NotarizationResponse>> {
    const formData = new FormData();
    formData.append('accountId', request.accountId);
    formData.append('contentType', request.contentType);
    
    if (request.text) {
      formData.append('text', request.text);
    }
    
    if (request.file) {
      formData.append('file', request.file);
    }
    
    if (request.title) {
      formData.append('title', request.title);
    }
    
    if (request.tags) {
      formData.append('tags', request.tags);
    }

    return this.fetchFormData<NotarizationResponse>('/api/notarize', formData);
  }

  /**
   * Get health status of backend services
   */
  async getHealthStatus(): Promise<ApiResponse<HealthCheckResponse>> {
    return this.fetchApi<HealthCheckResponse>('/api/health');
  }

  /**
   * Get IPFS gateway URLs for a CID
   */
  async getIPFSGateways(cid: string): Promise<ApiResponse<{ gatewayUrls: string[] }>> {
    return this.fetchApi<{ gatewayUrls: string[] }>(`/api/ipfs/${cid}`);
  }

  // ============================================================================
  // Phase 2: AI Processing APIs
  // ============================================================================

  /**
   * Get Phase 2 orchestrator status
   */
  async getPhase2Status(): Promise<ApiResponse<Phase2StatusResponse>> {
    return this.fetchApi<Phase2StatusResponse>('/api/phase2/status');
  }

  /**
   * Start Phase 2 real-time processing
   */
  async startPhase2(): Promise<ApiResponse<{ message: string }>> {
    return this.fetchApi<{ message: string }>('/api/phase2/start', {
      method: 'POST'
    });
  }

  /**
   * Stop Phase 2 processing
   */
  async stopPhase2(): Promise<ApiResponse<{ message: string }>> {
    return this.fetchApi<{ message: string }>('/api/phase2/stop', {
      method: 'POST'
    });
  }

  /**
   * Get all processed claims
   */
  async getProcessedClaims(): Promise<ApiResponse<{ claims: ProcessedClaim[], total: number }>> {
    return this.fetchApi<{ claims: ProcessedClaim[], total: number }>('/api/phase2/claims');
  }

  /**
   * Get specific processed claim by CID
   */
  async getClaimByCID(cid: string): Promise<ApiResponse<{ claim: ProcessedClaim }>> {
    return this.fetchApi<{ claim: ProcessedClaim }>(`/api/phase2/claims/${cid}`);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.getHealthStatus();
      return response.success;
    } catch {
      return false;
    }
  }

  /**
   * Get API base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Update API base URL
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }
}

/**
 * Default API service instance
 */
export const apiService = new ApiService();

/**
 * Hook for React components to use API service
 */
export function useApiService() {
  return apiService;
}
