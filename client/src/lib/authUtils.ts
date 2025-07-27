export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

// Enhanced auth utilities for custom authentication system
export const authUtils = {
  // Clear all cached authentication data
  clearAuthData: () => {
    localStorage.removeItem('auth-token');
    sessionStorage.clear();
  },

  // Check if user should be redirected to login
  shouldRedirectToLogin: (error: any) => {
    return error?.status === 401 || error?.message?.includes('Unauthorized');
  },

  // Handle authentication errors consistently
  handleAuthError: (error: any, toast?: any) => {
    if (authUtils.shouldRedirectToLogin(error)) {
      if (toast) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue.",
          variant: "destructive",
        });
      }
      
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
      return true;
    }
    return false;
  },

  // Enhanced logout with cleanup
  logout: async () => {
    try {
      // Call backend logout
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Always clear local data and redirect
      authUtils.clearAuthData();
      window.location.href = '/';
    }
  }
};