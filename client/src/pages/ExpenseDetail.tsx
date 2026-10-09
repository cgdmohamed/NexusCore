import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { format } from "date-fns";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Download,
  Receipt,
  Calendar,
  CreditCard,
  Tag,
  User,
  FileText,
  DollarSign,
  Wallet,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Header } from "@/components/dashboard/Header";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/usePermissions";
import type { Expense, ExpenseCategory } from "@shared/schema";

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { canApprove } = usePermissions();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: expense, isLoading } = useQuery<Expense>({
    queryKey: ["/api/expenses", id],
    enabled: !!id,
  });

  const { data: categories = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
  });

  const { data: paymentSources = [] } = useQuery<any[]>({
    queryKey: ["/api/payment-sources"],
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      toast({
        title: t("expenses.deleted"),
        description: t("expenses.deleted_desc"),
      });
      // Invalidate all expense-related queries to update statistics
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      setLocation("/expenses");
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || t("expenses.delete_failed_desc"),
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      await apiRequest("POST", `/api/expenses/${id}/reject`, { rejectionReason: reason });
    },
    onSuccess: () => {
      toast({
        title: "Expense Rejected",
        description: "The expense has been rejected and the submitter has been notified.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/stats"] });
      setRejectDialogOpen(false);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || "Failed to reject expense.",
        variant: "destructive",
      });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/expenses/${id}/pay`, {
        amount: expense?.amount,
        paymentMethod: expense?.paymentMethod,
        attachmentUrl: expense?.attachmentUrl,
        notes: `Payment for expense: ${expense?.title}`,
      });
    },
    onSuccess: () => {
      toast({
        title: t("expenses.paid"),
        description: t("expenses.paid_desc"),
      });
      // Invalidate all expense-related queries to update statistics
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-sources"] });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || t("expenses.pay_failed_desc"),
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800",
      approved: "bg-blue-100 text-blue-800",
      overdue: "bg-red-100 text-red-800",
      cancelled: "bg-muted text-foreground",
      rejected: "bg-red-100 text-red-800",
    };

    return (
      <Badge className={colors[status] || ""}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getCategoryInfo = (categoryId: string) => {
    if (!categories) return null;
    return categories.find((cat: any) => cat.id === categoryId);
  };

  const getPaymentSourceInfo = (paymentSourceId: string) => {
    if (!paymentSources || !paymentSourceId) return null;
    return paymentSources.find((source: any) => source.id === paymentSourceId);
  };

  const handleDelete = () => {
    if (
      window.confirm(
        "Are you sure you want to delete this expense? This action cannot be undone.",
      )
    ) {
      deleteMutation.mutate();
    }
  };

  const handleMarkAsPaid = () => {
    if (
      window.confirm(
        "Are you sure you want to mark this expense as paid? This will update the expense status.",
      )
    ) {
      paymentMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header
          title="Loading..."
          subtitle="Please wait while we load the expense details"
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="h-6 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="space-y-6">
        <Header
          title="Expense Not Found"
          subtitle="The requested expense could not be found"
        />
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/70 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Expense Not Found
            </h3>
            <p className="text-muted-foreground mb-4">
              The expense you're looking for doesn't exist or has been deleted.
            </p>
            <Link href="/expenses">
              <Button>
                <ArrowLeft className="h-4 w-4 me-2" />
                Back to Expenses
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const categoryInfo = getCategoryInfo(expense.categoryId);
  const paymentSourceInfo = expense.paymentSourceId
    ? getPaymentSourceInfo(expense.paymentSourceId)
    : null;

  return (
    <div className="space-y-6">
      <Header
        title={expense.title}
        subtitle={`Expense #${expense.id.slice(0, 8)}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 p-3 md:p-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Expense Overview */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-xl sm:text-2xl font-bold text-foreground break-words">
                    {expense.title}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {getStatusBadge(expense.status)}
                    {expense.isRecurring && (
                      <Badge variant="outline">Recurring</Badge>
                    )}
                  </div>
                </div>
                <div className="sm:text-end flex-shrink-0">
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">
                    {formatCurrency(expense.amount)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {expense.type.charAt(0).toUpperCase() +
                      expense.type.slice(1)}{" "}
                    Expense
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {expense.description && (
                <div>
                  <h4 className="font-medium text-foreground mb-2">
                    Description
                  </h4>
                  <p className="text-muted-foreground">{expense.description}</p>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground/70" />
                    <div>
                      <div className="font-medium">Expense Date</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(expense.expenseDate), "MMMM dd, yyyy")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground/70" />
                    <div>
                      <div className="font-medium">Payment Method</div>
                      <div className="text-sm text-muted-foreground capitalize">
                        {expense.paymentMethod.replace("_", " ")}
                      </div>
                    </div>
                  </div>

                  {categoryInfo && (
                    <div className="flex items-center gap-3">
                      <Tag className="h-5 w-5 text-muted-foreground/70" />
                      <div>
                        <div className="font-medium">Category</div>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: categoryInfo?.color || '#gray' }}
                          />
                          <span className="text-sm text-muted-foreground">
                            {categoryInfo?.name || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentSourceInfo && (
                    <div className="flex items-center gap-3">
                      <Wallet className="h-5 w-5 text-muted-foreground/70" />
                      <div>
                        <div className="font-medium">Payment Source</div>
                        <div className="text-sm text-muted-foreground">
                          {paymentSourceInfo.name}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground/70" />
                    <div>
                      <div className="font-medium">Submitted By</div>
                      <div className="text-sm text-muted-foreground">
                        {"System User"}
                      </div>
                    </div>
                  </div>

                  {expense.attachmentUrl && (
                    <div className="flex items-center gap-3">
                      <Receipt className="h-5 w-5 text-muted-foreground/70" />
                      <div>
                        <div className="font-medium">Receipt</div>
                        <Button variant="outline" size="sm" className="mt-1">
                          <Download className="h-4 w-4 me-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  )}

                  {expense.relatedClientId && (
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground/70" />
                      <div>
                        <div className="font-medium">Related Client</div>
                        <div className="text-sm text-muted-foreground">
                          Client #{expense.relatedClientId.slice(0, 8)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href={`/expenses/${id}/edit`}>
                <Button className="w-full" variant="outline">
                  <Edit className="h-4 w-4 me-2" />
                  Edit Expense
                </Button>
              </Link>

              {expense.status !== "paid" && (
                <Button
                  className="w-full"
                  variant="default"
                  onClick={handleMarkAsPaid}
                  disabled={paymentMutation.isPending}
                >
                  <DollarSign className="h-4 w-4 me-2" />
                  {paymentMutation.isPending ? "Processing..." : "Mark as Paid"}
                </Button>
              )}

              {canApprove("expenses") && expense.status !== "rejected" && expense.status !== "paid" && (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => setRejectDialogOpen(true)}
                  data-testid="button-reject-expense"
                >
                  <XCircle className="h-4 w-4 me-2" />
                  Reject Expense
                </Button>
              )}

              <Button
                className="w-full"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 me-2" />
                {deleteMutation.isPending ? "Deleting..." : "Delete Expense"}
              </Button>

              <Link href="/expenses">
                <Button className="w-full" variant="ghost">
                  <ArrowLeft className="h-4 w-4 me-2" />
                  Back to Expenses
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Expense Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-medium">
                    {formatCurrency(expense.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {getStatusBadge(expense.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Type</span>
                  <span className="font-medium capitalize">{expense.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span className="font-medium">
                    {format(new Date(expense.expenseDate), "MMM dd, yyyy")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rejection Info */}
          {expense.status === "rejected" && expense.rejectionReason && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-700 flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  Rejection Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground">{expense.rejectionReason}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Rejection Reason Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for rejecting this expense. The submitter will be notified.
            </p>
            <div>
              <Label htmlFor="rejection-reason">Rejection Reason</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter the reason for rejection..."
                rows={4}
                className="mt-1"
                data-testid="input-rejection-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectionReason(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate(rejectionReason)}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
