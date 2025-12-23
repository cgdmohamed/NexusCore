import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ProfilePictureUpload } from "@/components/ProfilePictureUpload";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Employee } from "@shared/schema";
import { z } from "zod";
import { useState } from "react";

const employeeFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.enum(["operations", "finance", "hr", "sales", "management", "it", "marketing"]),
  hiringDate: z.string().optional(),
  status: z.enum(["active", "inactive", "terminated", "on_leave"]),
  profileImage: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof employeeFormSchema>;

interface EmployeeFormProps {
  employee?: Employee;
  onClose: () => void;
}

export function EmployeeForm({ employee, onClose }: EmployeeFormProps) {
  const { toast } = useToast();
  const isEditing = !!employee;

  const form = useForm<FormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      firstName: employee?.firstName || "",
      lastName: employee?.lastName || "",
      email: employee?.email || "",
      phone: employee?.phone || "",
      jobTitle: employee?.jobTitle || "",
      department: employee?.department || "operations",
      hiringDate: employee?.hiringDate ? new Date(employee.hiringDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      status: employee?.status || "active",
      profileImage: employee?.profileImage || "",
      notes: employee?.notes || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const submitData = {
        ...data,
        email: data.email || null,
        hiringDate: data.hiringDate ? new Date(data.hiringDate) : null,
      };
      
      if (isEditing) {
        return await apiRequest("PUT", `/api/employees/${employee.id}`, submitData);
      } else {
        return await apiRequest("POST", "/api/employees", submitData);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Employee ${isEditing ? "updated" : "created"} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-management/stats"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditing ? "update" : "create"} employee`,
        variant: "destructive",
      });
    },
  });



  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  const departments = [
    { value: "operations", label: "Operations" },
    { value: "finance", label: "Finance" },
    { value: "hr", label: "Human Resources" },
    { value: "sales", label: "Sales" },
    { value: "management", label: "Management" },
    { value: "it", label: "Information Technology" },
  ];

  const statuses = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "terminated", label: "Terminated" },
    { value: "on_leave", label: "On Leave" },
  ];

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            placeholder="John"
            {...form.register("firstName")}
          />
          {form.formState.errors.firstName && (
            <p className="text-sm text-red-600">{form.formState.errors.firstName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            placeholder="Doe"
            {...form.register("lastName")}
          />
          {form.formState.errors.lastName && (
            <p className="text-sm text-red-600">{form.formState.errors.lastName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email Address *</Label>
          <Input
            id="email"
            type="email"
            placeholder="john.doe@company.com"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            placeholder="+1-555-0123"
            {...form.register("phone")}
          />
          {form.formState.errors.phone && (
            <p className="text-sm text-red-600">{form.formState.errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="jobTitle">Job Title *</Label>
          <Input
            id="jobTitle"
            placeholder="Software Engineer"
            {...form.register("jobTitle")}
          />
          {form.formState.errors.jobTitle && (
            <p className="text-sm text-red-600">{form.formState.errors.jobTitle.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="department">Department *</Label>
          <Select
            value={form.watch("department")}
            onValueChange={(value) => form.setValue("department", value as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept.value} value={dept.value}>
                  {dept.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.department && (
            <p className="text-sm text-red-600">{form.formState.errors.department.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="hiringDate">Hiring Date *</Label>
          <Input
            id="hiringDate"
            type="date"
            {...form.register("hiringDate")}
          />
          {form.formState.errors.hiringDate && (
            <p className="text-sm text-red-600">{form.formState.errors.hiringDate.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status *</Label>
          <Select
            value={form.watch("status")}
            onValueChange={(value) => form.setValue("status", value as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.status && (
            <p className="text-sm text-red-600">{form.formState.errors.status.message}</p>
          )}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Profile Image</Label>
          <ProfilePictureUpload
            currentImage={form.watch("profileImage")}
            initials={`${form.watch("firstName")?.[0] || ""}${form.watch("lastName")?.[0] || ""}`}
            onImageChange={(imageUrl) => {
              form.setValue("profileImage", imageUrl || "");
            }}
            size="md"
            editable={true}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            placeholder="Additional notes about the employee..."
            rows={3}
            {...form.register("notes")}
          />
          {form.formState.errors.notes && (
            <p className="text-sm text-red-600">{form.formState.errors.notes.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending 
            ? (isEditing ? "Updating..." : "Creating...") 
            : (isEditing ? "Update Employee" : "Add Employee")
          }
        </Button>
      </div>
    </form>
  );
}