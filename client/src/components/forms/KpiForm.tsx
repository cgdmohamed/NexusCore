import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertEmployeeKpiSchema, type EmployeeKpi, type InsertEmployeeKpi } from "@shared/schema";
import { z } from "zod";

const kpiFormSchema = insertEmployeeKpiSchema.extend({
  title: z.string().min(1, "Title is required"),
  evaluationPeriod: z.string().min(1, "Evaluation period is required"),
});

type KpiFormData = z.infer<typeof kpiFormSchema>;

interface KpiFormProps {
  employeeId: string;
  kpi?: EmployeeKpi | null;
  onClose: () => void;
}

export function KpiForm({ employeeId, kpi, onClose }: KpiFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<KpiFormData>({
    resolver: zodResolver(kpiFormSchema),
    defaultValues: {
      employeeId,
      title: kpi?.title || "",
      description: kpi?.description || "",
      targetValue: kpi?.targetValue || "",
      actualValue: kpi?.actualValue || "",
      evaluationPeriod: kpi?.evaluationPeriod || "",
      status: kpi?.status || "not_evaluated",
      notes: kpi?.notes || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertEmployeeKpi) => {
      const response = await apiRequest("POST", `/api/employees/${employeeId}/kpis`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/kpis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/kpi-stats`] });
      toast({
        title: "Success",
        description: "KPI created successfully",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertEmployeeKpi>) => {
      const response = await apiRequest("PUT", `/api/kpis/${kpi?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/kpis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/kpi-stats`] });
      toast({
        title: "Success",
        description: "KPI updated successfully",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: KpiFormData) => {
    if (kpi) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "exceeded": return "text-green-600";
      case "on_track": return "text-blue-600";
      case "below_target": return "text-orange-600";
      case "not_evaluated": return "text-gray-600";
      default: return "text-gray-600";
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>KPI Title *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g., Monthly Sales, Tasks Delivered, Code Quality"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="evaluationPeriod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Evaluation Period *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g., July 2025, Q2 2025, Jan 1 - Mar 31, 2025"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Optional description of what this KPI measures"
                  rows={3}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="targetValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Value</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g., 100, 95%, $50,000"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="actualValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Actual Value</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g., 95, 98%, $48,500"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="not_evaluated">
                      <span className={getStatusColor("not_evaluated")}>Not Evaluated</span>
                    </SelectItem>
                    <SelectItem value="exceeded">
                      <span className={getStatusColor("exceeded")}>Exceeded</span>
                    </SelectItem>
                    <SelectItem value="on_track">
                      <span className={getStatusColor("on_track")}>On Track</span>
                    </SelectItem>
                    <SelectItem value="below_target">
                      <span className={getStatusColor("below_target")}>Below Target</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes & Comments</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Additional notes, feedback, or comments about this KPI"
                  rows={4}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending 
              ? "Saving..." 
              : kpi ? "Update KPI" : "Create KPI"
            }
          </Button>
        </div>
      </form>
    </Form>
  );
}