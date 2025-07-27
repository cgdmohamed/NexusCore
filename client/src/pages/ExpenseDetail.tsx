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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/dashboard/Header";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Expense, ExpenseCategory } from "@shared/schema";

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

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
        title: "Success",
        description: "Expense deleted successfully",
      });
      // Invalidate all expense-related queries to update statistics
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      setLocation("/expenses");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete expense",
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
        title: "Success",
        description: "Expense marked as paid successfully",
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
        title: "Error",
        description: error.message || "Failed to mark expense as paid",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      paid: "default",
      overdue: "destructive",
      cancelled: "outline",
    } as const;

    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-800",
    } as const;

    return (
      <Badge 
        variant={variants[status as keyof typeof variants] || "outline"}
        className={colors[status as keyof typeof colors] || ""}
      >
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
                <div className="h-6 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
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
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Expense Not Found
            </h3>
            <p className="text-gray-500 mb-4">
              The expense you're looking for doesn't exist or has been deleted.
            </p>
            <Link href="/expenses">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Expenses
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const categoryInfo = getCategoryInfo(expense.categoryId);

  return (
    <div className="space-y-6">
      <Header
        title={expense.title}
        subtitle={`Expense #${expense.id.slice(0, 8)}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Expense Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold text-gray-900">
                    {expense.title}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    {getStatusBadge(expense.status)}
                    {expense.isRecurring && (
                      <Badge variant="outline">Recurring</Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">
                    ${parseFloat(expense.amount).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
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
                  <h4 className="font-medium text-gray-900 mb-2">
                    Description
                  </h4>
                  <p className="text-gray-600">{expense.description}</p>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium">Expense Date</div>
                      <div className="text-sm text-gray-500">
                        {format(new Date(expense.expenseDate), "MMMM dd, yyyy")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium">Payment Method</div>
                      <div className="text-sm text-gray-500 capitalize">
                        {expense.paymentMethod.replace("_", " ")}
                      </div>
                    </div>
                  </div>

                  {categoryInfo && (
                    <div className="flex items-center gap-3">
                      <Tag className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-medium">Category</div>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: categoryInfo?.color || '#gray' }}
                          />
                          <span className="text-sm text-gray-500">
                            {categoryInfo?.name || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {getPaymentSourceInfo(expense.paymentSourceId) && (
                    <div className="flex items-center gap-3">
                      <Wallet className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-medium">Payment Source</div>
                        <div className="text-sm text-gray-500">
                          {getPaymentSourceInfo(expense.paymentSourceId)?.name}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium">Submitted By</div>
                      <div className="text-sm text-gray-500">
                        {"System User"}
                      </div>
                    </div>
                  </div>

                  {expense.attachmentUrl && (
                    <div className="flex items-center gap-3">
                      <Receipt className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-medium">Receipt</div>
                        <Button variant="outline" size="sm" className="mt-1">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  )}

                  {expense.relatedClientId && (
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-medium">Related Client</div>
                        <div className="text-sm text-gray-500">
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
                  <Edit className="h-4 w-4 mr-2" />
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
                  <DollarSign className="h-4 w-4 mr-2" />
                  {paymentMutation.isPending ? "Processing..." : "Mark as Paid"}
                </Button>
              )}

              <Button
                className="w-full"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleteMutation.isPending ? "Deleting..." : "Delete Expense"}
              </Button>

              <Link href="/expenses">
                <Button className="w-full" variant="ghost">
                  <ArrowLeft className="h-4 w-4 mr-2" />
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
                  <span className="text-sm text-gray-500">Amount</span>
                  <span className="font-medium">
                    ${parseFloat(expense.amount).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  {getStatusBadge(expense.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Type</span>
                  <span className="font-medium capitalize">{expense.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Date</span>
                  <span className="font-medium">
                    {format(new Date(expense.expenseDate), "MMM dd, yyyy")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
