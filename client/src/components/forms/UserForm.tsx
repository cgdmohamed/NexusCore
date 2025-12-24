import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertUserSchema, type User } from "@shared/schema";
import { z } from "zod";

const createFormSchema = (isEditing: boolean) => z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  employeeId: z.string().min(1, "Employee is required"),
  roleId: z.string().min(1, "Role is required"),
  isActive: z.boolean().default(true),
  mustChangePassword: z.boolean().default(true),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  // For new users, password is required
  if (!isEditing && (!data.password || data.password.length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Password is required",
  path: ["password"],
}).refine((data) => {
  // Only validate password length if a password is provided
  if (data.password && data.password.length > 0 && data.password.length < 8) {
    return false;
  }
  return true;
}, {
  message: "Password must be at least 8 characters",
  path: ["password"],
}).refine((data) => {
  // Only check password match if a password is provided
  if (data.password && data.password.length > 0 && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormData = z.infer<ReturnType<typeof createFormSchema>>;

interface UserFormProps {
  user?: User;
  onClose: () => void;
}

export function UserForm({ user, onClose }: UserFormProps) {
  const { toast } = useToast();
  const isEditing = !!user;

  // Fetch employees without user accounts
  const { data: employees = [] } = useQuery({
    queryKey: ["/api/employees"],
  });

  // Fetch roles
  const { data: roles = [] } = useQuery({
    queryKey: ["/api/roles"],
  });

  const formSchema = createFormSchema(isEditing);
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      employeeId: user?.employeeId || "",
      roleId: user?.roleId || "",
      isActive: user?.isActive ?? true,
      mustChangePassword: user?.mustChangePassword ?? true,
      password: "",
      confirmPassword: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { confirmPassword, ...submitData } = data;
      
      if (isEditing) {
        return await apiRequest("PUT", `/api/users/${user.id}`, submitData);
      } else {
        return await apiRequest("POST", "/api/users", submitData);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `User account ${isEditing ? "updated" : "created"} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-management/stats"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditing ? "update" : "create"} user account`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  // Filter employees to show only those without user accounts (unless editing)
  const availableEmployees = employees.filter((emp: any) => 
    !emp.hasUserAccount || (isEditing && emp.id === user?.employeeId)
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="username">Username *</Label>
          <Input
            id="username"
            placeholder="Enter username"
            {...form.register("username")}
          />
          {form.formState.errors.username && (
            <p className="text-sm text-red-600">{form.formState.errors.username.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email Address *</Label>
          <Input
            id="email"
            type="email"
            placeholder="user@company.com"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="employeeId">Employee *</Label>
          <Select
            value={form.watch("employeeId")}
            onValueChange={(value) => form.setValue("employeeId", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {availableEmployees.map((employee: any) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName} - {employee.jobTitle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.employeeId && (
            <p className="text-sm text-red-600">{form.formState.errors.employeeId.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="roleId">Role *</Label>
          <Select
            value={form.watch("roleId")}
            onValueChange={(value) => form.setValue("roleId", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role: any) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name} - {role.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.roleId && (
            <p className="text-sm text-red-600">{form.formState.errors.roleId.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            {isEditing ? "New Password (leave blank to keep current)" : "Password *"}
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter password"
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Confirm password"
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword && (
            <p className="text-sm text-red-600">{form.formState.errors.confirmPassword.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={form.watch("isActive")}
            onCheckedChange={(checked) => form.setValue("isActive", checked)}
          />
          <Label htmlFor="isActive">Account Active</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="mustChangePassword"
            checked={form.watch("mustChangePassword")}
            onCheckedChange={(checked) => form.setValue("mustChangePassword", checked)}
          />
          <Label htmlFor="mustChangePassword">Must Change Password on First Login</Label>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending 
            ? (isEditing ? "Updating..." : "Creating...") 
            : (isEditing ? "Update User Account" : "Create User Account")
          }
        </Button>
      </div>
    </form>
  );
}