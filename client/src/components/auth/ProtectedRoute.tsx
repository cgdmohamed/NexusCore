import { ReactNode, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/lib/i18n";
import { Loader2, Shield } from "lucide-react";
import { authUtils } from "@/lib/authUtils";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  requiredDepartment?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRole, 
  requiredDepartment 
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/';
    }
  }, [isAuthenticated, isLoading]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return null; // useEffect will handle the redirect
  }

  // Check role-based access
  if (requiredRole && (user as any).role !== requiredRole) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md p-8">
          <Shield className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access this page. Required role: {requiredRole}
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Check department-based access
  if (requiredDepartment && (user as any).department !== requiredDepartment) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md p-8">
          <Shield className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access this page. Required department: {requiredDepartment}
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}