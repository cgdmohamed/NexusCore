import { useQuery, useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading, refetch, error } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const res = await fetch('/api/auth/user', {
        credentials: 'include',
      });
      
      // Return null for 401 (unauthorized) instead of throwing
      if (res.status === 401) {
        return null;
      }
      
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      
      return await res.json();
    },
    retry: false,
    staleTime: 0, // Always refresh on mount
    refetchOnWindowFocus: true,
    throwOnError: false, // Don't throw on 401 errors
  });

  const logout = async () => {
    try {
      // Immediately set user to null to trigger UI update
      queryClient.setQueryData(["/api/auth/user"], null);
      
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // Clear all cached data
      queryClient.clear();
      localStorage.clear();
      sessionStorage.clear();
      
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear data and set user to null
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.clear();
    }
  };

  // User is authenticated if we have user data (null means 401/unauthorized)
  const isAuthenticated = !!user;

  return {
    user,
    isLoading,
    isAuthenticated,
    logout,
  };
}
