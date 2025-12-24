import { useAuth } from "./useAuth";

export type ModulePermissions = {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
};

export type PermissionsMap = Record<string, ModulePermissions>;

export function usePermissions() {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  const permissions = (user as any)?.permissions as PermissionsMap | undefined;
  const roleName = (user as any)?.roleName as string | undefined;
  
  // While loading or if no permissions yet, return true to avoid hiding navigation
  const permissionsLoaded = isAuthenticated && permissions !== undefined;
  
  const hasPermission = (module: string, action: keyof ModulePermissions): boolean => {
    // If still loading or not authenticated yet, allow access (UI will handle auth redirect)
    if (isLoading || !isAuthenticated) return true;
    // If authenticated but no permissions loaded, allow access (fallback)
    if (!permissions) return true;
    
    const modulePermissions = permissions[module];
    if (!modulePermissions) return false;
    return modulePermissions[action] === true;
  };
  
  const canView = (module: string): boolean => hasPermission(module, 'view');
  const canAdd = (module: string): boolean => hasPermission(module, 'add');
  const canEdit = (module: string): boolean => hasPermission(module, 'edit');
  const canDelete = (module: string): boolean => hasPermission(module, 'delete');
  const canApprove = (module: string): boolean => hasPermission(module, 'approve');
  
  const isAdmin = roleName === 'Admin';
  
  return {
    permissions,
    roleName,
    permissionsLoaded,
    isLoading,
    hasPermission,
    canView,
    canAdd,
    canEdit,
    canDelete,
    canApprove,
    isAdmin,
  };
}
