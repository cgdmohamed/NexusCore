/**
 * Simple, smart API utilities that replace the complex queryClient approach
 */

interface ApiConfig {
  showToast?: boolean;
  retries?: number;
  timeout?: number;
}

const defaultConfig: ApiConfig = {
  showToast: true,
  retries: 2,
  timeout: 10000,
};

/**
 * Smart fetch with automatic error handling
 */
export async function smartFetch<T = any>(
  endpoint: string, 
  options: RequestInit & ApiConfig = {}
): Promise<T> {
  const { showToast, retries, timeout, ...fetchOptions } = { ...defaultConfig, ...options };
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const config: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
    signal: controller.signal,
    ...fetchOptions,
  };

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(endpoint, config);
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          // Redirect to login on auth failure
          if (!window.location.pathname.includes('/auth')) {
            window.location.href = '/auth';
          }
          throw new Error('Authentication required');
        }
        
        const errorText = await response.text();
        let errorMessage = `Request failed (${response.status})`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Don't retry on auth errors or client errors
      if (lastError.message.includes('Authentication') || (error as any)?.status >= 400) {
        break;
      }
      
      // Wait before retry
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // Show error toast if enabled
  if (showToast && lastError && !lastError.message.includes('Authentication')) {
    // Only show toast if there's a toast system available
    if (typeof window !== 'undefined' && (window as any).showToast) {
      (window as any).showToast({
        title: 'Error',
        description: lastError.message,
        variant: 'destructive',
      });
    }
  }

  throw lastError;
}

/**
 * GET request
 */
export const GET = <T = any>(endpoint: string, config?: ApiConfig): Promise<T> =>
  smartFetch<T>(endpoint, { method: 'GET', ...config });

/**
 * POST request
 */
export const POST = <T = any>(endpoint: string, data?: any, config?: ApiConfig): Promise<T> =>
  smartFetch<T>(endpoint, { 
    method: 'POST', 
    body: data ? JSON.stringify(data) : undefined,
    ...config 
  });

/**
 * PUT request
 */
export const PUT = <T = any>(endpoint: string, data?: any, config?: ApiConfig): Promise<T> =>
  smartFetch<T>(endpoint, { 
    method: 'PUT', 
    body: data ? JSON.stringify(data) : undefined,
    ...config 
  });

/**
 * DELETE request
 */
export const DELETE = <T = any>(endpoint: string, config?: ApiConfig): Promise<T> =>
  smartFetch<T>(endpoint, { method: 'DELETE', ...config });

/**
 * PATCH request
 */
export const PATCH = <T = any>(endpoint: string, data?: any, config?: ApiConfig): Promise<T> =>
  smartFetch<T>(endpoint, { 
    method: 'PATCH', 
    body: data ? JSON.stringify(data) : undefined,
    ...config 
  });