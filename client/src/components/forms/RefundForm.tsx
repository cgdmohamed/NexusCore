import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, DollarSign, Calendar, FileText, Banknote } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface RefundFormProps {
  type: "invoice" | "credit";
  invoiceId?: string;
  clientId?: string;
  maxRefundAmount: number;
  onRefundSuccess: () => void;
  onCancel: () => void;
}

export function RefundForm({ 
  type, 
  invoiceId, 
  clientId, 
  maxRefundAmount, 
  onRefundSuccess, 
  onCancel 
}: RefundFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    refundAmount: "",
    refundMethod: "",
    refundReference: "",
    notes: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState("");

  const handleAmountChange = (value: string) => {
    const numValue = parseFloat(value);
    if (numValue > maxRefundAmount) {
      setValidationError(`Refund amount cannot exceed ${maxRefundAmount} EGP`);
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

    if (refundAmount > maxRefundAmount) {
      toast({
        title: "Amount Exceeds Limit",
        description: `Refund amount cannot exceed ${maxRefundAmount} EGP`,
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

    setIsLoading(true);

    try {
      let endpoint = "";
      let requestData = {
        refundAmount: refundAmount,
        refundMethod: formData.refundMethod,
        refundReference: formData.refundReference,
        notes: formData.notes
      };

      if (type === "invoice" && invoiceId) {
        endpoint = `/api/invoices/${invoiceId}/refund`;
      } else if (type === "credit" && clientId) {
        endpoint = `/api/clients/${clientId}/credit/refund`;
      }

      await apiRequest("POST", endpoint, requestData);

      toast({
        title: "Refund Processed",
        description: `Successfully processed refund of ${refundAmount} EGP`,
      });

      onRefundSuccess();
    } catch (error: any) {
      console.error("Refund error:", error);
      toast({
        title: "Refund Failed",
        description: error.message || "Failed to process refund",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Process {type === "invoice" ? "Invoice" : "Credit"} Refund
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Refund Amount */}
          <div className="space-y-2">
            <Label htmlFor="refundAmount">Refund Amount (EGP)</Label>
            <Input
              id="refundAmount"
              type="number"
              step="0.01"
              min="0.01"
              max={maxRefundAmount}
              value={formData.refundAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              required
            />
            <div className="text-xs text-muted-foreground">
              Maximum refundable: {maxRefundAmount} EGP
            </div>
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

          {/* Summary */}
          {formData.refundAmount && (
            <Alert>
              <Banknote className="h-4 w-4" />
              <AlertDescription>
                <strong>Refund Summary:</strong><br />
                Amount: {formData.refundAmount} EGP<br />
                Method: {formData.refundMethod}<br />
                {formData.refundReference && `Reference: ${formData.refundReference}`}
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !!validationError || !formData.refundAmount || !formData.refundMethod}
              className="flex-1"
            >
              {isLoading ? "Processing..." : "Process Refund"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}