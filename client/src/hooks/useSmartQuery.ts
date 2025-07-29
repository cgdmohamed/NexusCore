import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { api, ApiResponse } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

interface SmartQueryOptions<T> extends Omit<UseQueryOptions<ApiResponse<T>>, 'queryFn'> {
  endpoint: string;
  showError?: boolean;
  showSuccess?: boolean;
}

interface SmartMutationOptions<TData, TVariables> extends Omit<UseMutationOptions<ApiResponse<TData>, Error, TVariables>, 'mutationFn'> {
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string | ((variables: TVariables) => string);
  showError?: boolean;
  showSuccess?: boolean;
  successMessage?: string;
  invalidateKeys?: string[][];
}

/**
 * Smart query hook with automatic error handling
 */
export function useSmartQuery<T>(options: SmartQueryOptions<T>) {
  const { endpoint, showError = true, showSuccess = false, ...queryOptions } = options;
  const { toast } = useToast();

  const query = useQuery({
    ...queryOptions,
    queryFn: async () => {
      const response = await api.get<T>(endpoint);
      
      if (!response.success) {
        if (response.status === 401) {
          // Auth error - let the auth system handle it
          throw new Error('Authentication required');
        }
        throw new Error(response.error || 'Request failed');
      }
      
      if (showSuccess) {
        toast({
          title: 'Success',
          description: 'Data loaded successfully',
        });
      }
      
      return response;
    },
  });

  // Handle errors with toast notifications
  useEffect(() => {
    if (query.error && showError) {
      const errorMessage = query.error instanceof Error ? query.error.message : 'An error occurred';
      
      if (!errorMessage.includes('Authentication required')) {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    }
  }, [query.error, showError, toast]);

  return {
    ...query,
    data: query.data?.data, // Extract the actual data
    isSuccess: query.isSuccess && query.data?.success,
  };
}

/**
 * Smart mutation hook with automatic error handling and cache invalidation
 */
export function useSmartMutation<TData = any, TVariables = any>(
  options: SmartMutationOptions<TData, TVariables>
) {
  const { 
    method, 
    endpoint, 
    showError = true, 
    showSuccess = true, 
    successMessage,
    invalidateKeys = [],
    ...mutationOptions 
  } = options;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    ...mutationOptions,
    mutationFn: async (variables: TVariables) => {
      const url = typeof endpoint === 'function' ? endpoint(variables) : endpoint;
      const response = await api.makeRequest<TData>(method, url, variables);
      
      if (!response.success) {
        throw new Error(response.error || 'Request failed');
      }
      
      return response;
    },
    onSuccess: (data, variables, context) => {
      // Show success message
      if (showSuccess) {
        toast({
          title: 'Success',
          description: successMessage || 'Operation completed successfully',
        });
      }

      // Invalidate cache keys
      invalidateKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });

      // Call original onSuccess if provided
      if (mutationOptions.onSuccess) {
        mutationOptions.onSuccess(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      // Show error message
      if (showError) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        
        if (!errorMessage.includes('Authentication required')) {
          toast({
            title: 'Error',
            description: errorMessage,
            variant: 'destructive',
          });
        }
      }

      // Call original onError if provided
      if (mutationOptions.onError) {
        mutationOptions.onError(error, variables, context);
      }
    },
  });
}

/**
 * Authentication event listener
 */
export function useAuthListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleAuthExpired = () => {
      // Clear all cache when auth expires
      queryClient.clear();
      
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/auth')) {
        window.location.href = '/auth';
      }
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, [queryClient]);
}