import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, DollarSign, Calendar, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface CreditRefundFormProps {
  clientId: string;
  availableCredit: number;
  onRefundSuccess: () => void;
  onCancel: () => void;
}

export function CreditRefundForm({ 
  clientId, 
  availableCredit, 
  onRefundSuccess, 
  onCancel 
}: CreditRefundFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    refundAmount: "",
    refundMethod: "",
    refundReference: "",
    notes: ""
  });
  const [validationError, setValidationError] = useState("");

  const refundMutation = useMutation({
    mutationFn: async (refundData: any) => {
      return apiRequest("POST", `/api/clients/${clientId}/credit/refund`, refundData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/credit`] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      
      toast({
        title: "Credit Refund Processed",
        description: `Successfully processed credit refund of ${formData.refundAmount} EGP`,
      });
      onRefundSuccess();
    },
    onError: (error: any) => {
      console.error("Credit refund error:", error);
      toast({
        title: "Refund Failed",
        description: error.message || "Failed to process credit refund",
        variant: "destructive",
      });
    }
  });

  const handleAmountChange = (value: string) => {
    const numValue = parseFloat(value);
    if (numValue > availableCredit) {
      setValidationError(`Refund amount cannot exceed available credit (${availableCredit} EGP)`);
    } else {
      setValidationError("");
    }
    setFormData(prev => ({ ...prev, refundAmount: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const refundAmount = parseFloat(formData.refundAmount);
    
    if (!refundAmount || refundAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid refund amount",
        variant: "destructive"
      });
      return;
    }

    if (refundAmount > availableCredit) {
      toast({
        title: "Amount Exceeds Limit",
        description: `Refund amount cannot exceed available credit (${availableCredit} EGP)`,
        variant: "destructive"
      });
      return;
    }

    if (!formData.refundMethod) {
      toast({
        title: "Missing Method",
        description: "Please select a refund method",
        variant: "destructive"
      });
      return;
    }

    refundMutation.mutate({
      refundAmount: refundAmount,
      refundMethod: formData.refundMethod,
      refundReference: formData.refundReference,
      notes: formData.notes
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Process Credit Refund
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Available Credit Display */}
          <div className="bg-blue-50 p-3 rounded-md">
            <div className="text-sm text-blue-700">
              Available Credit Balance: <strong>{availableCredit} EGP</strong>
            </div>
          </div>

          {/* Refund Amount */}
          <div className="space-y-2">
            <Label htmlFor="refundAmount">Refund Amount (EGP)</Label>
            <Input
              id="refundAmount"
              type="number"
              step="0.01"
              min="0.01"
              max={availableCredit}
              value={formData.refundAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              required
            />
            {validationError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Refund Method */}
          <div className="space-y-2">
            <Label>Refund Method</Label>
            <Select 
              value={formData.refundMethod} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, refundMethod: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select refund method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="credit_card">Credit Card Reversal</SelectItem>
                <SelectItem value="check">Check</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Refund Reference */}
          <div className="space-y-2">
            <Label htmlFor="refundReference">Reference Number (Optional)</Label>
            <Input
              id="refundReference"
              value={formData.refundReference}
              onChange={(e) => setFormData(prev => ({ ...prev, refundReference: e.target.value }))}
              placeholder="Transaction/Reference number"
            />
          </div>

          {/* Date Display */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Refund Date
            </Label>
            <div className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded">
              {format(new Date(), "PPP")}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes about this refund..."
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={refundMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={refundMutation.isPending || !!validationError || !formData.refundAmount || !formData.refundMethod}
              className="flex-1"
            >
              {refundMutation.isPending ? "Processing..." : "Process Refund"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}