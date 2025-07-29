/**
 * Smart API client with automatic error handling and retry logic
 */

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
  success: boolean;
}

export class ApiClient {
  private baseUrl: string = '';
  private defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  constructor() {
    // Auto-detect base URL
    this.baseUrl = window.location.origin;
  }

  private async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: any,
    options: { retry?: boolean; timeout?: number } = {}
  ): Promise<ApiResponse<T>> {
    const { retry = true, timeout = 10000 } = options;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const config: RequestInit = {
        method,
        headers: this.defaultHeaders,
        credentials: 'include', // Important for session cookies
        signal: controller.signal,
      };

      if (data && method !== 'GET') {
        config.body = JSON.stringify(data);
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      clearTimeout(timeoutId);

      let responseData;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (response.ok) {
        return {
          data: responseData,
          status: response.status,
          success: true,
        };
      }

      // Handle authentication errors
      if (response.status === 401) {
        // Clear any cached auth state
        window.dispatchEvent(new CustomEvent('auth-expired'));
        return {
          error: 'Authentication required',
          status: 401,
          success: false,
        };
      }

      return {
        error: responseData?.message || `Request failed with status ${response.status}`,
        status: response.status,
        success: false,
      };

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            error: 'Request timeout',
            status: 408,
            success: false,
          };
        }
        
        // Network error or server unavailable
        if (!navigator.onLine) {
          return {
            error: 'No internet connection',
            status: 0,
            success: false,
          };
        }

        // Retry logic for network errors
        if (retry && (error.message.includes('fetch') || error.message.includes('network'))) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          return this.makeRequest(method, endpoint, data, { retry: false, timeout });
        }
      }

      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 0,
        success: false,
      };
    }
  }

  // GET request
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('GET', endpoint);
  }

  // POST request
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('POST', endpoint, data);
  }

  // PUT request
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('PUT', endpoint, data);
  }

  // DELETE request
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('DELETE', endpoint);
  }

  // PATCH request
  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('PATCH', endpoint, data);
  }
}

// Create singleton instance
export const api = new ApiClient();

// Legacy compatibility - smart wrapper for existing apiRequest function
export const apiRequest = async (method: string, url: string, data?: any) => {
  const response = await api.makeRequest(method, url, data);
  
  if (!response.success) {
    throw new Error(response.error || 'Request failed');
  }
  
  // Return Response-like object for compatibility
  return {
    ok: true,
    status: response.status,
    json: async () => response.data,
    text: async () => response.data,
  };
};