import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertPaymentSourceSchema, type InsertPaymentSource, type PaymentSource } from "@shared/schema";
import { z } from "zod";

const formSchema = insertPaymentSourceSchema.extend({
  initialBalance: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PaymentSourceFormProps {
  paymentSource?: PaymentSource;
  onClose: () => void;
}

export function PaymentSourceForm({ paymentSource, onClose }: PaymentSourceFormProps) {
  const { toast } = useToast();
  const isEditing = !!paymentSource;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: paymentSource?.name || "",
      description: paymentSource?.description || "",
      accountType: paymentSource?.accountType || "bank",
      currency: paymentSource?.currency || "USD",
      initialBalance: paymentSource?.initialBalance || "0",
      isActive: paymentSource?.isActive ?? true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (isEditing) {
        return await apiRequest("PUT", `/api/payment-sources/${paymentSource.id}`, data);
      } else {
        return await apiRequest("POST", "/api/payment-sources", data);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Payment source ${isEditing ? "updated" : "created"} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-sources"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditing ? "update" : "create"} payment source`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            placeholder="e.g., Bank Misr - Main Account"
            {...form.register("name")}
          />
          {form.formState.errors.name && (
            <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="accountType">Account Type *</Label>
          <Select
            value={form.watch("accountType")}
            onValueChange={(value) => form.setValue("accountType", value as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select account type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank">Bank Account</SelectItem>
              <SelectItem value="cash">Cash/Safe</SelectItem>
              <SelectItem value="wallet">Mobile Wallet</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.accountType && (
            <p className="text-sm text-red-600">{form.formState.errors.accountType.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Select
            value={form.watch("currency")}
            onValueChange={(value) => form.setValue("currency", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="EGP">EGP</SelectItem>
              <SelectItem value="SAR">SAR</SelectItem>
              <SelectItem value="AED">AED</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="initialBalance">
            {isEditing ? "Current Balance" : "Initial Balance"}
          </Label>
          <Input
            id="initialBalance"
            type="number"
            step="0.01"
            placeholder="0.00"
            {...form.register("initialBalance")}
          />
          {form.formState.errors.initialBalance && (
            <p className="text-sm text-red-600">{form.formState.errors.initialBalance.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Optional description for this payment source"
          rows={3}
          {...form.register("description")}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          checked={form.watch("isActive")}
          onCheckedChange={(checked) => form.setValue("isActive", checked)}
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending 
            ? (isEditing ? "Updating..." : "Creating...") 
            : (isEditing ? "Update Payment Source" : "Create Payment Source")
          }
        </Button>
      </div>
    </form>
  );
}