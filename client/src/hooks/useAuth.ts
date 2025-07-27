import { useQuery, useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 0, // Always refresh on mount
    refetchOnWindowFocus: true,
  });

  const logout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // Always clear data regardless of response
      queryClient.clear();
      localStorage.clear();
      sessionStorage.clear();
      
      // Invalidate the auth query to trigger re-render
      queryClient.setQueryData(["/api/auth/user"], null);
      
      // Force refetch to ensure auth state is updated
      refetch();
      
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear data and refetch
      queryClient.clear();
      queryClient.setQueryData(["/api/auth/user"], null);
      refetch();
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
  };
}
