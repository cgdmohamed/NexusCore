import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertRoleSchema, type Role } from "@shared/schema";

type FormData = typeof insertRoleSchema._type;

interface RoleFormProps {
  role?: Role;
  onClose: () => void;
}

const modules = [
  { key: "dashboard", label: "Dashboard", description: "Main dashboard and KPI access" },
  { key: "crm", label: "CRM", description: "Client relationship management" },
  { key: "quotations", label: "Quotations", description: "Quotation creation and management" },
  { key: "invoices", label: "Invoices", description: "Invoice management and billing" },
  { key: "expenses", label: "Expenses", description: "Expense tracking and approval" },
  { key: "paymentSources", label: "Payment Sources", description: "Payment method management" },
  { key: "employees", label: "Employees", description: "Employee profile management" },
  { key: "users", label: "Users", description: "User account management" },
  { key: "roles", label: "Roles", description: "Role and permission management" },
  { key: "tasks", label: "Tasks", description: "Task assignment and tracking" },
  { key: "analytics", label: "Analytics", description: "Business analytics and reports" },
  { key: "auditLogs", label: "Audit Logs", description: "System activity logs" },
];

const permissions = [
  { key: "view", label: "View", description: "Can view data" },
  { key: "add", label: "Add", description: "Can create new records" },
  { key: "edit", label: "Edit", description: "Can modify existing records" },
  { key: "delete", label: "Delete", description: "Can delete records" },
  { key: "approve", label: "Approve", description: "Can approve/reject records" },
];

export function RoleForm({ role, onClose }: RoleFormProps) {
  const { toast } = useToast();
  const isEditing = !!role;

  // Initialize permissions with default values
  const defaultPermissions = modules.reduce((acc, module) => {
    acc[module.key] = permissions.reduce((modulePerms, perm) => {
      modulePerms[perm.key] = false;
      return modulePerms;
    }, {} as Record<string, boolean>);
    return acc;
  }, {} as Record<string, Record<string, boolean>>);

  const form = useForm<FormData>({
    resolver: zodResolver(insertRoleSchema),
    defaultValues: {
      name: role?.name || "",
      description: role?.description || "",
      permissions: role?.permissions || defaultPermissions,
      isActive: role?.isActive ?? true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (isEditing) {
        return await apiRequest("PUT", `/api/roles/${role.id}`, data);
      } else {
        return await apiRequest("POST", "/api/roles", data);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Role ${isEditing ? "updated" : "created"} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-management/stats"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditing ? "update" : "create"} role`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  const handlePermissionChange = (moduleKey: string, permissionKey: string, value: boolean) => {
    const currentPermissions = form.getValues("permissions") as any;
    const updatedPermissions = {
      ...currentPermissions,
      [moduleKey]: {
        ...currentPermissions[moduleKey],
        [permissionKey]: value,
      },
    };
    form.setValue("permissions", updatedPermissions);
  };

  const handleModuleSelectAll = (moduleKey: string, selectAll: boolean) => {
    const currentPermissions = form.getValues("permissions") as any;
    const modulePermissions = permissions.reduce((acc, perm) => {
      acc[perm.key] = selectAll;
      return acc;
    }, {} as Record<string, boolean>);

    const updatedPermissions = {
      ...currentPermissions,
      [moduleKey]: modulePermissions,
    };
    form.setValue("permissions", updatedPermissions);
  };

  const currentPermissions = form.watch("permissions") as any;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">Role Name *</Label>
          <Input
            id="name"
            placeholder="Admin"
            {...form.register("name")}
          />
          {form.formState.errors.name && (
            <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="flex items-center space-x-2 pt-7">
          <Switch
            id="isActive"
            checked={form.watch("isActive")}
            onCheckedChange={(checked) => form.setValue("isActive", checked)}
          />
          <Label htmlFor="isActive">Role Active</Label>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe the role and its responsibilities..."
            rows={3}
            {...form.register("description")}
          />
          {form.formState.errors.description && (
            <p className="text-sm text-red-600">{form.formState.errors.description.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Permissions</h3>
        <p className="text-sm text-gray-600">
          Configure what this role can access and perform in each module
        </p>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {modules.map((module) => (
            <Card key={module.key}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{module.label}</CardTitle>
                    <p className="text-sm text-gray-600">{module.description}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleModuleSelectAll(module.key, true)}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleModuleSelectAll(module.key, false)}
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {permissions.map((permission) => (
                    <div key={permission.key} className="flex items-center space-x-2">
                      <Switch
                        id={`${module.key}-${permission.key}`}
                        checked={currentPermissions?.[module.key]?.[permission.key] || false}
                        onCheckedChange={(checked) => 
                          handlePermissionChange(module.key, permission.key, checked)
                        }
                      />
                      <Label 
                        htmlFor={`${module.key}-${permission.key}`}
                        className="text-sm"
                        title={permission.description}
                      >
                        {permission.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending 
            ? (isEditing ? "Updating..." : "Creating...") 
            : (isEditing ? "Update Role" : "Create Role")
          }
        </Button>
      </div>
    </form>
  );
}