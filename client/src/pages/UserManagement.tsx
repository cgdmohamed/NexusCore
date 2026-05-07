import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Users,
  UserPlus,
  Shield,
  Search,
  Eye,
  Edit,
  UserCheck,
  UserX,
  Activity,
  Settings,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { UserForm } from "@/components/forms/UserForm";
import { EmployeeForm } from "@/components/forms/EmployeeForm";
import { RoleForm, modules as ROLE_MODULES } from "@/components/forms/RoleForm";
import type { User, Employee, Role } from "@shared/schema";
import { Link } from "wouter";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RoleWithCount extends Role {
  userCount: number;
}

interface RoleUser {
  id: string;
  email: string;
  isActive: boolean;
  employeeId: string | null;
  employee: {
    firstName: string;
    lastName: string;
    profileImage: string | null;
  } | null;
}

interface UserManagementStats {
  totalEmployees: number;
  activeEmployees: number;
  totalUsers: number;
  activeUsers: number;
  totalRoles: number;
  employeesWithoutAccounts: number;
}

// Intersection types so these are assignable to the base User/Employee schema types
type UserWithEmployee = User & {
  role?: { name: string } | null;
  employee?: {
    firstName: string;
    lastName: string;
    jobTitle?: string;
    department?: string;
    profileImage?: string;
  } | null;
};

type EmployeeWithAccount = Employee & {
  hasUserAccount: boolean;
};

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  user?: { employee?: { firstName?: string; lastName?: string } | null } | null;
}

// ─── Permission display constants ────────────────────────────────────────────

const PERMISSION_KEYS = ["view", "add", "edit", "delete", "approve"] as const;
type PermissionKey = typeof PERMISSION_KEYS[number];

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  view: "View",
  add: "Add",
  edit: "Edit",
  delete: "Delete",
  approve: "Approve",
};

// ─── Role View Dialog ─────────────────────────────────────────────────────────

function RoleViewDialog({
  role,
  open,
  onClose,
}: {
  role: RoleWithCount | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data: roleUsers = [], isLoading } = useQuery<RoleUser[]>({
    queryKey: ["/api/roles", role?.id, "users"],
    enabled: open && !!role,
  });

  if (!role) return null;

  const permissions = (role.permissions ?? {}) as Record<string, Record<string, boolean>>;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {role.name}
            <Badge variant={role.isActive ? "default" : "secondary"} className="text-xs ml-1">
              {role.isActive ? "Active" : "Inactive"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {role.description && (
          <p className="text-sm text-gray-600 -mt-2">{role.description}</p>
        )}

        <div className="space-y-5">
          {/* Full permission matrix — all modules, all permission types */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Permissions
            </h4>

            {/* Header row */}
            <div className="grid grid-cols-[1fr_repeat(5,_auto)] gap-x-3 gap-y-1 mb-1">
              <div />
              {PERMISSION_KEYS.map(pk => (
                <span key={pk} className="text-xs font-medium text-gray-500 text-center w-14">
                  {PERMISSION_LABELS[pk]}
                </span>
              ))}
            </div>

            <div className="divide-y divide-gray-100 border border-gray-100 rounded-md overflow-hidden">
              {ROLE_MODULES.map(module => {
                const modulePerms = permissions[module.key] ?? {};
                return (
                  <div
                    key={module.key}
                    className="grid grid-cols-[1fr_repeat(5,_auto)] gap-x-3 items-center px-3 py-2 bg-white hover:bg-gray-50"
                  >
                    <span className="text-sm text-gray-700 font-medium">{module.label}</span>
                    {PERMISSION_KEYS.map(pk => (
                      <div key={pk} className="flex justify-center w-14">
                        {modulePerms[pk] ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-200" />
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Assigned Users */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Assigned Users ({role.userCount})
            </h4>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : roleUsers.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No users assigned to this role</p>
            ) : (
              <div className="space-y-2">
                {roleUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-3">
                    <Avatar className="w-7 h-7 shrink-0">
                      <AvatarImage src={u.employee?.profileImage ?? undefined} />
                      <AvatarFallback className="bg-primary text-white text-xs">
                        {u.employee?.firstName?.[0]}{u.employee?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text truncate">
                        {u.employee
                          ? `${u.employee.firstName} ${u.employee.lastName}`
                          : u.email}
                      </p>
                      {u.employee && (
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      )}
                    </div>
                    <Badge
                      variant={u.isActive ? "default" : "secondary"}
                      className="text-xs ml-auto shrink-0"
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UserManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("users");
  const [showUserForm, setShowUserForm] = useState(false);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [cloneRoleData, setCloneRoleData] = useState<Partial<Role> | null>(null);
  const [viewingRole, setViewingRole] = useState<RoleWithCount | null>(null);
  const [showRoleView, setShowRoleView] = useState(false);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const response = await apiRequest("DELETE", `/api/employees/${employeeId}`);
      return response.json() as Promise<{ message: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-management/stats"] });
      toast({ title: t("userManagement.deleted"), description: data.message || t("messages.success.deleted") });
    },
    onError: (error: Error) => {
      toast({ title: t("userManagement.delete_failed"), description: error.message || t("userManagement.delete_failed_desc"), variant: "destructive" });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const response = await apiRequest("DELETE", `/api/roles/${roleId}`);
      return response.json() as Promise<{ message: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-management/stats"] });
      toast({ title: "Role deleted", description: "The role has been removed successfully." });
    },
    onError: (error: Error) => {
      toast({
        title: "Cannot delete role",
        description: error.message || "Failed to delete role",
        variant: "destructive",
      });
    },
  });

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: userList = [], isLoading: usersLoading } = useQuery<UserWithEmployee[]>({
    queryKey: ["/api/users"],
  });
  const { data: employeeList = [], isLoading: employeesLoading } = useQuery<EmployeeWithAccount[]>({
    queryKey: ["/api/employees"],
  });
  const { data: roleList = [], isLoading: rolesLoading } = useQuery<RoleWithCount[]>({
    queryKey: ["/api/roles"],
  });
  const { data: stats } = useQuery<UserManagementStats>({
    queryKey: ["/api/user-management/stats"],
  });
  const { data: auditLogs = [] } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs"],
  });

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filteredUsers = userList.filter(user =>
    user.employee?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.employee?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEmployees = employeeList.filter(employee =>
    employee.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRoles = roleList.filter(role =>
    role.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDeleteEmployee = (employee: EmployeeWithAccount) => {
    if (window.confirm(t("userManagement.delete_confirm", { name: `${employee.firstName} ${employee.lastName}` }))) {
      deleteEmployeeMutation.mutate(employee.id);
    }
  };

  const handleDeleteRole = (role: RoleWithCount) => {
    if (role.userCount > 0) return;
    if (window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) {
      deleteRoleMutation.mutate(role.id);
    }
  };

  const handleCloneRole = (role: RoleWithCount) => {
    const { id: _id, userCount: _uc, ...rest } = role;
    setCloneRoleData({ ...rest, name: `${rest.name} (Copy)` });
    setEditingRole(null);
    setShowRoleForm(true);
  };

  const handleViewRole = (role: RoleWithCount) => {
    setViewingRole(role);
    setShowRoleView(true);
  };

  const handleEditUser = (user: User) => { setEditingUser(user); setShowUserForm(true); };
  const handleEditEmployee = (employee: Employee) => { setEditingEmployee(employee); setShowEmployeeForm(true); };
  const handleEditRole = (role: Role) => { setCloneRoleData(null); setEditingRole(role); setShowRoleForm(true); };
  const closeUserForm = () => { setShowUserForm(false); setEditingUser(null); };
  const closeEmployeeForm = () => { setShowEmployeeForm(false); setEditingEmployee(null); };
  const closeRoleForm = () => { setShowRoleForm(false); setEditingRole(null); setCloneRoleData(null); };

  // ── Stat cards ─────────────────────────────────────────────────────────────

  const statCards = [
    { label: "Total Employees", value: stats?.totalEmployees, icon: Users, color: "blue" },
    { label: "Active Employees", value: stats?.activeEmployees, icon: UserCheck, color: "green" },
    { label: "System Users", value: stats?.totalUsers, icon: Shield, color: "purple" },
    { label: "Active Users", value: stats?.activeUsers, icon: UserCheck, color: "emerald" },
    { label: "Active Roles", value: stats?.totalRoles, icon: Settings, color: "gray" },
    { label: "No User Account", value: stats?.employeesWithoutAccounts, icon: UserX, color: "orange" },
  ];

  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    emerald: "bg-emerald-50 text-emerald-600",
    gray: "bg-gray-100 text-gray-600",
    orange: "bg-orange-50 text-orange-600",
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Header
          title={t('nav.team_roles')}
          subtitle="Manage system users, employee profiles, and role-based access control"
        />

        <div className="p-3 md:p-6 space-y-5">

          {/* Statistics Cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {statCards.map(({ label, value, icon: Icon, color }) => (
                <Card key={label}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs text-gray-500 leading-tight">{label}</p>
                      <div className={`p-1.5 rounded-md shrink-0 ${colorMap[color]}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-text">{value ?? "—"}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users, employees, roles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setShowEmployeeForm(true)} data-testid="button-add-employee">
                <UserPlus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
              <Button onClick={() => setShowUserForm(true)} data-testid="button-create-user">
                <Shield className="h-4 w-4 mr-2" />
                Create User Account
              </Button>
              <Button
                variant="outline"
                onClick={() => { setCloneRoleData(null); setEditingRole(null); setShowRoleForm(true); }}
                data-testid="button-new-role"
              >
                <Settings className="h-4 w-4 mr-2" />
                New Role
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList>
              <TabsTrigger value="users">System Users ({userList.length})</TabsTrigger>
              <TabsTrigger value="employees">Employees ({employeeList.length})</TabsTrigger>
              <TabsTrigger value="roles">Roles ({roleList.length})</TabsTrigger>
              <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            </TabsList>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-3 mt-4">
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-gray-500">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>No users found</p>
                  </CardContent>
                </Card>
              ) : (
                filteredUsers.map((user) => (
                  <Card key={user.id} className="hover:shadow-sm transition-shadow" data-testid={`card-user-${user.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="w-10 h-10 shrink-0">
                            <AvatarImage src={user.employee?.profileImage} />
                            <AvatarFallback className="bg-primary text-white text-sm font-medium">
                              {user.employee?.firstName?.[0]}{user.employee?.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold text-text truncate">
                              {user.employee?.firstName} {user.employee?.lastName}
                            </p>
                            <p className="text-sm text-gray-500 truncate">{user.email}</p>
                            <p className="text-xs text-gray-400 truncate">
                              {user.employee?.jobTitle}{user.employee?.department ? ` · ${user.employee.department}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right hidden sm:block">
                            <Badge variant={user.isActive ? "default" : "secondary"} className="mb-1">
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                            {user.role?.name && (
                              <p className="text-xs text-gray-500">{user.role.name}</p>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            <Link href={`/users/${user.id}`}>
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0" data-testid={`button-view-user-${user.id}`}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handleEditUser(user)} data-testid={`button-edit-user-${user.id}`}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Employees Tab */}
            <TabsContent value="employees" className="space-y-3 mt-4">
              {employeesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : filteredEmployees.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-gray-500">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>No employees found</p>
                  </CardContent>
                </Card>
              ) : (
                filteredEmployees.map((employee) => (
                  <Card key={employee.id} className="hover:shadow-sm transition-shadow" data-testid={`card-employee-${employee.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="w-10 h-10 shrink-0">
                            <AvatarImage src={employee.profileImage ?? undefined} />
                            <AvatarFallback className="bg-primary text-white text-sm font-medium">
                              {employee.firstName?.[0]}{employee.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold text-text truncate">
                              {employee.firstName} {employee.lastName}
                            </p>
                            <p className="text-sm text-gray-500 truncate">{employee.email}</p>
                            <p className="text-xs text-gray-400 truncate">
                              {employee.jobTitle}{employee.department ? ` · ${employee.department}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right hidden sm:block space-y-1">
                            <Badge variant={employee.status === 'active' ? "default" : "secondary"}>
                              {employee.status}
                            </Badge>
                            <div>
                              {employee.hasUserAccount ? (
                                <Badge variant="outline" className="text-green-600 text-xs">Has Account</Badge>
                              ) : (
                                <Badge variant="outline" className="text-orange-500 text-xs">No Account</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <Link href={`/employees/${employee.id}`}>
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0" data-testid={`button-view-employee-${employee.id}`}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handleEditEmployee(employee)} data-testid={`button-edit-employee-${employee.id}`}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleDeleteEmployee(employee)}
                              disabled={deleteEmployeeMutation.isPending}
                              data-testid={`button-delete-employee-${employee.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Roles Tab */}
            <TabsContent value="roles" className="space-y-3 mt-4">
              {rolesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : filteredRoles.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-gray-500">
                    <Settings className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>No roles found</p>
                  </CardContent>
                </Card>
              ) : (
                filteredRoles.map((role) => {
                  const permissions = (role.permissions ?? {}) as Record<string, Record<string, boolean>>;
                  const permEntries = ROLE_MODULES
                    .map(m => ({
                      module: m.key,
                      label: m.label,
                      allowed: PERMISSION_KEYS.filter(pk => permissions[m.key]?.[pk]),
                    }))
                    .filter(e => e.allowed.length > 0);

                  const canDelete = role.userCount === 0;

                  return (
                    <Card key={role.id} className="hover:shadow-sm transition-shadow" data-testid={`card-role-${role.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold text-text">{role.name}</h3>
                              <Badge variant={role.isActive ? "default" : "secondary"} className="text-xs">
                                {role.isActive ? "Active" : "Inactive"}
                              </Badge>
                              <Badge variant="outline" className="text-xs text-gray-500 font-normal">
                                <Users className="h-3 w-3 mr-1 inline-block" />
                                {role.userCount} {role.userCount === 1 ? "user" : "users"}
                              </Badge>
                            </div>
                            {role.description && (
                              <p className="text-sm text-gray-500 mb-3">{role.description}</p>
                            )}
                            {permEntries.length > 0 && (
                              <div className="space-y-1.5">
                                {permEntries.map(({ module, label, allowed }) => (
                                  <div key={module} className="flex items-start gap-2 flex-wrap">
                                    <span className="text-xs font-medium text-gray-500 w-28 shrink-0 pt-0.5">
                                      {label}
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                      {allowed.map(perm => (
                                        <Badge key={perm} variant="outline" className="text-xs h-5 px-1.5 py-0 capitalize font-normal">
                                          {perm}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-1.5 shrink-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleViewRole(role)}
                                  data-testid={`button-view-role-${role.id}`}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View details</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleEditRole(role)}
                                  data-testid={`button-edit-role-${role.id}`}
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit role</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleCloneRole(role)}
                                  data-testid={`button-clone-role-${role.id}`}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Duplicate role</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={`h-8 w-8 p-0 ${canDelete ? "text-red-500 hover:text-red-600 hover:bg-red-50" : "opacity-40 cursor-not-allowed"}`}
                                    onClick={() => canDelete && handleDeleteRole(role)}
                                    disabled={!canDelete || deleteRoleMutation.isPending}
                                    data-testid={`button-delete-role-${role.id}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {canDelete
                                  ? "Delete role"
                                  : `Cannot delete — ${role.userCount} user${role.userCount !== 1 ? "s" : ""} assigned`}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            {/* Audit Tab */}
            <TabsContent value="audit" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {auditLogs.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No audit logs found</p>
                  ) : (
                    <div className="divide-y">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                          <div>
                            <p className="text-sm font-medium text-text">
                              {log.action} {log.entityType}
                            </p>
                            <p className="text-xs text-gray-500">
                              by {log.user?.employee?.firstName} {log.user?.employee?.lastName}
                            </p>
                          </div>
                          <p className="text-xs text-gray-400">
                            {new Date(log.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Role View Dialog */}
        <RoleViewDialog
          role={viewingRole}
          open={showRoleView}
          onClose={() => { setShowRoleView(false); setViewingRole(null); }}
        />

        {/* Dialog Forms */}
        <Dialog open={showUserForm} onOpenChange={setShowUserForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingUser ? "Edit User" : "Create New User"}</DialogTitle>
            </DialogHeader>
            <UserForm user={editingUser ?? undefined} onClose={closeUserForm} />
          </DialogContent>
        </Dialog>

        <Dialog open={showEmployeeForm} onOpenChange={setShowEmployeeForm}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{editingEmployee ? "Edit Employee" : "Create New Employee"}</DialogTitle>
            </DialogHeader>
            <EmployeeForm employee={editingEmployee ?? undefined} onClose={closeEmployeeForm} />
          </DialogContent>
        </Dialog>

        <Dialog open={showRoleForm} onOpenChange={setShowRoleForm}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRole ? "Edit Role" : cloneRoleData ? "Duplicate Role" : "New Role"}
              </DialogTitle>
            </DialogHeader>
            <RoleForm role={editingRole} initialData={cloneRoleData} onClose={closeRoleForm} />
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
