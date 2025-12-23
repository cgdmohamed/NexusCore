// Client-side configuration
import { useQuery } from '@tanstack/react-query';

interface AppConfig {
  companyName: string;
  companyTagline: string;
}

// Default configuration (fallback values)
const defaultConfig: AppConfig = {
  companyName: 'Creative Code Nexus',
  companyTagline: 'Digital Solutions & Innovation',
};

// Get configuration from global window object (set by server) or API
declare global {
  interface Window {
    APP_CONFIG?: AppConfig;
  }
}

// Static config for immediate use
export const config: AppConfig = {
  companyName: window.APP_CONFIG?.companyName || defaultConfig.companyName,
  companyTagline: window.APP_CONFIG?.companyTagline || defaultConfig.companyTagline,
};

// Hook for reactive configuration
export function useConfig() {
  const { data: serverConfig } = useQuery<AppConfig>({
    queryKey: ['/api/config'],
    staleTime: Infinity, // Config doesn't change often
  });

  return {
    companyName: serverConfig?.companyName || config.companyName,
    companyTagline: serverConfig?.companyTagline || config.companyTagline,
  };
}

export default config;