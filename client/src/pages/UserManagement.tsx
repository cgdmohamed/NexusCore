import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Settings
} from "lucide-react";
import { UserForm } from "@/components/forms/UserForm";
import { EmployeeForm } from "@/components/forms/EmployeeForm";
import { RoleForm } from "@/components/forms/RoleForm";
import type { User, Employee, Role } from "@shared/schema";
import { Link } from "wouter";

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("users");
  const [showUserForm, setShowUserForm] = useState(false);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Fetch data
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["/api/employees"],
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["/api/roles"],
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/user-management/stats"],
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["/api/audit-logs"],
  });

  // Filter functions
  const filteredUsers = users.filter((user: any) =>
    user.employee?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.employee?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEmployees = employees.filter((employee: any) =>
    employee.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRoles = roles.filter((role: Role) =>
    role.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowUserForm(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowEmployeeForm(true);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setShowRoleForm(true);
  };

  const closeUserForm = () => {
    setShowUserForm(false);
    setEditingUser(null);
  };

  const closeEmployeeForm = () => {
    setShowEmployeeForm(false);
    setEditingEmployee(null);
  };

  const closeRoleForm = () => {
    setShowRoleForm(false);
    setEditingRole(null);
  };

  return (
    <div className="space-y-6">
      <Header 
        title="User & Employee Management" 
        subtitle="Manage system users, employee profiles, and role-based access control"
      />
      
      <div className="p-6 space-y-6">

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalEmployees}</p>
                  <p className="text-xs text-gray-600">Total Employees</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <UserCheck className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.activeEmployees}</p>
                  <p className="text-xs text-gray-600">Active Employees</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  <p className="text-xs text-gray-600">System Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <UserCheck className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.activeUsers}</p>
                  <p className="text-xs text-gray-600">Active Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Settings className="h-8 w-8 text-gray-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalRoles}</p>
                  <p className="text-xs text-gray-600">Active Roles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <UserX className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.employeesWithoutAccounts}</p>
                  <p className="text-xs text-gray-600">No User Account</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Actions */}
      <div className="flex justify-between items-center">
        <div className="relative w-64">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search users, employees, roles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex space-x-2">
          <Button onClick={() => setShowEmployeeForm(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
          
          <Button onClick={() => setShowUserForm(true)}>
            <Shield className="h-4 w-4 mr-2" />
            Create User Account
          </Button>
          
          <Button variant="outline" onClick={() => setShowRoleForm(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Manage Roles
          </Button>
        </div>
      </div>

      {/* Tabs for different views */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="users">System Users ({users.length})</TabsTrigger>
          <TabsTrigger value="employees">Employees ({employees.length})</TabsTrigger>
          <TabsTrigger value="roles">Roles ({roles.length})</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="grid gap-4">
            {usersLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No users found</p>
                </CardContent>
              </Card>
            ) : (
              filteredUsers.map((user: any) => (
                <Card key={user.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <img
                          src={user.employee?.profileImageUrl || `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100`}
                          alt="Profile"
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div>
                          <h3 className="font-semibold">
                            {user.employee?.firstName} {user.employee?.lastName}
                          </h3>
                          <p className="text-sm text-gray-600">{user.email}</p>
                          <p className="text-sm text-gray-500">
                            {user.employee?.jobTitle} • {user.employee?.department}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <Badge variant={user.isActive ? "default" : "secondary"}>
                            {user.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <p className="text-sm text-gray-500 mt-1">
                            Role: {user.role?.name}
                          </p>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <div className="grid gap-4">
            {employeesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No employees found</p>
                </CardContent>
              </Card>
            ) : (
              filteredEmployees.map((employee: any) => (
                <Card key={employee.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <img
                          src={employee.profileImageUrl || `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100`}
                          alt="Profile"
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div>
                          <h3 className="font-semibold">
                            {employee.firstName} {employee.lastName}
                          </h3>
                          <p className="text-sm text-gray-600">{employee.email}</p>
                          <p className="text-sm text-gray-500">
                            {employee.jobTitle} • {employee.department}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <Badge variant={employee.status === 'active' ? "default" : "secondary"}>
                            {employee.status}
                          </Badge>
                          <div className="flex items-center space-x-2 mt-1">
                            {employee.hasUserAccount ? (
                              <Badge variant="outline" className="text-green-600">
                                Has User Account
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-orange-600">
                                No User Account
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Link href={`/employees/${employee.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEditEmployee(employee)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="grid gap-4">
            {rolesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredRoles.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No roles found</p>
                </CardContent>
              </Card>
            ) : (
              filteredRoles.map((role: Role) => (
                <Card key={role.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{role.name}</h3>
                        <p className="text-gray-600 mb-2">{role.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(role.permissions as any || {}).map(([module, perms]: [string, any]) => (
                            <Badge key={module} variant="outline" className="text-xs">
                              {module}: {Object.entries(perms).filter(([_, allowed]) => allowed).map(([perm]) => perm).join(', ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <Badge variant={role.isActive ? "default" : "secondary"}>
                          {role.isActive ? "Active" : "Inactive"}
                        </Badge>
                        
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEditRole(role)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Recent Activity</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditLogs.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No audit logs found</p>
                ) : (
                  auditLogs.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <p className="font-medium">
                          {log.action} {log.entityType}
                        </p>
                        <p className="text-sm text-gray-600">
                          by {log.user?.employee?.firstName} {log.user?.employee?.lastName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {new Date(log.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Dialog Forms */}
      <Dialog open={showUserForm} onOpenChange={setShowUserForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Create New User"}</DialogTitle>
          </DialogHeader>
          <UserForm user={editingUser} onClose={closeUserForm} />
        </DialogContent>
      </Dialog>
      
      <Dialog open={showEmployeeForm} onOpenChange={setShowEmployeeForm}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Edit Employee" : "Create New Employee"}</DialogTitle>
          </DialogHeader>
          <EmployeeForm employee={editingEmployee} onClose={closeEmployeeForm} />
        </DialogContent>
      </Dialog>
      
      <Dialog open={showRoleForm} onOpenChange={setShowRoleForm}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Create New Role"}</DialogTitle>
          </DialogHeader>
          <RoleForm role={editingRole} onClose={closeRoleForm} />
        </DialogContent>
      </Dialog>
      
      </div>
    </div>
  );
}