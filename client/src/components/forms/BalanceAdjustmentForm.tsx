import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type PaymentSource } from "@shared/schema";
import { z } from "zod";
import { formatCurrency } from "@/lib/currency";

const adjustmentSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  description: z.string().min(1, "Description is required"),
  type: z.enum(["income", "adjustment"]),
});

type AdjustmentData = z.infer<typeof adjustmentSchema>;

interface BalanceAdjustmentFormProps {
  paymentSource: PaymentSource;
  onClose: () => void;
}

export function BalanceAdjustmentForm({ paymentSource, onClose }: BalanceAdjustmentFormProps) {
  const { toast } = useToast();

  const form = useForm<AdjustmentData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      amount: "",
      description: "",
      type: "adjustment",
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async (data: AdjustmentData) => {
      return await apiRequest("POST", `/api/payment-sources/${paymentSource.id}/adjust-balance`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Balance adjusted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-sources/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-sources", paymentSource.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-sources", paymentSource.id, "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to adjust balance",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AdjustmentData) => {
    // Convert amount to positive or negative based on adjustment type
    const amount = parseFloat(data.amount);
    const adjustedAmount = data.type === "income" ? Math.abs(amount) : 
      (amount > 0 ? -amount : amount); // Allow negative adjustments

    adjustMutation.mutate({
      ...data,
      amount: adjustedAmount.toString(),
    });
  };

  const watchedAmount = form.watch("amount");
  const watchedType = form.watch("type");
  const currentBalance = parseFloat(paymentSource.currentBalance);
  const adjustmentAmount = parseFloat(watchedAmount || "0");
  
  const newBalance = watchedType === "income" 
    ? currentBalance + Math.abs(adjustmentAmount)
    : currentBalance - Math.abs(adjustmentAmount);

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">{paymentSource.name}</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Current Balance:</span>
            <span className="font-mono font-semibold ml-2">
              {formatCurrency(currentBalance)}
            </span>
          </div>
          {watchedAmount && (
            <div>
              <span className="text-gray-600">New Balance:</span>
              <span className={`font-mono font-semibold ml-2 ${newBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(newBalance)}
              </span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="type">Adjustment Type *</Label>
          <Select
            value={form.watch("type")}
            onValueChange={(value) => form.setValue("type", value as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select adjustment type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Add Funds (Income)</SelectItem>
              <SelectItem value="adjustment">Deduct Funds (Correction)</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.type && (
            <p className="text-sm text-red-600">{form.formState.errors.type.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Amount *</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            {...form.register("amount")}
          />
          {form.formState.errors.amount && (
            <p className="text-sm text-red-600">{form.formState.errors.amount.message}</p>
          )}
          <p className="text-xs text-gray-500">
            {watchedType === "income" 
              ? "Positive amount will be added to the balance"
              : "Amount will be deducted from the balance"
            }
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Reason/Description *</Label>
          <Textarea
            id="description"
            placeholder="Explain the reason for this balance adjustment"
            rows={3}
            {...form.register("description")}
          />
          {form.formState.errors.description && (
            <p className="text-sm text-red-600">{form.formState.errors.description.message}</p>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={adjustMutation.isPending}>
            {adjustMutation.isPending ? "Adjusting..." : "Adjust Balance"}
          </Button>
        </div>
      </form>
    </div>
  );
}