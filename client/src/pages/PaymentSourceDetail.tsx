import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { format } from "date-fns";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Wallet,
  Building,
  CreditCard,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Activity,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/dashboard/Header";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BalanceAdjustmentForm } from "@/components/forms/BalanceAdjustmentForm";
import type { PaymentSource, PaymentSourceTransaction, Expense } from "@shared/schema";

export default function PaymentSourceDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: paymentSource, isLoading } = useQuery<PaymentSource>({
    queryKey: ["/api/payment-sources", id],
    enabled: !!id,
  });

  const { data: transactions = [] } = useQuery<PaymentSourceTransaction[]>({
    queryKey: ["/api/payment-sources", id, "transactions"],
    enabled: !!id,
  });

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/payment-sources", id, "expenses"],
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/payment-sources/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payment source deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-sources"] });
      setLocation("/payment-sources");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete payment source",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "default",
      inactive: "secondary",
      suspended: "destructive",
    } as const;

    const colors = {
      active: "bg-green-50 text-green-700 border-green-200",
      inactive: "bg-gray-50 text-gray-700 border-gray-200",
      suspended: "bg-red-50 text-red-700 border-red-200",
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

  const getTypeBadge = (type: string) => {
    const icons = {
      bank_account: <Building className="h-3 w-3" />,
      credit_card: <CreditCard className="h-3 w-3" />,
      digital_wallet: <Wallet className="h-3 w-3" />,
      cash: <DollarSign className="h-3 w-3" />,
    };

    return (
      <div className="flex items-center gap-2">
        {icons[type as keyof typeof icons]}
        <span className="capitalize">{type.replace("_", " ")}</span>
      </div>
    );
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "expense":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case "adjustment":
        return <Settings className="h-4 w-4 text-blue-500" />;
      case "refund":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleDelete = () => {
    if (
      window.confirm(
        "Are you sure you want to delete this payment source? This action cannot be undone.",
      )
    ) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header
          title="Loading..."
          subtitle="Please wait while we load the payment source details"
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

  if (!paymentSource) {
    return (
      <div className="space-y-6">
        <Header
          title="Payment Source Not Found"
          subtitle="The requested payment source could not be found"
        />
        <Card>
          <CardContent className="text-center py-12">
            <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Payment Source Not Found
            </h3>
            <p className="text-gray-500 mb-4">
              The payment source you're looking for doesn't exist or has been deleted.
            </p>
            <Link href="/payment-sources">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Payment Sources
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header
        title={paymentSource.name}
        subtitle={`Payment Source #${paymentSource.id.slice(0, 8)}`}
        breadcrumbs={[
          { label: "Payment Sources", href: "/payment-sources" },
          { label: paymentSource.name },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Payment Source Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold text-gray-900">
                    {paymentSource.name}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    {getStatusBadge(paymentSource.status)}
                    <Badge variant="outline">
                      {getTypeBadge(paymentSource.type)}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">
                    ${parseFloat(paymentSource.currentBalance || "0").toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Current Balance
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {paymentSource.description && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">
                    Description
                  </h4>
                  <p className="text-gray-600">{paymentSource.description}</p>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium">Created Date</div>
                      <div className="text-sm text-gray-500">
                        {format(new Date(paymentSource.createdAt), "MMMM dd, yyyy")}
                      </div>
                    </div>
                  </div>

                  {paymentSource.accountNumber && (
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-medium">Account Number</div>
                        <div className="text-sm text-gray-500">
                          ****{paymentSource.accountNumber.slice(-4)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {paymentSource.bankName && (
                    <div className="flex items-center gap-3">
                      <Building className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-medium">Bank Name</div>
                        <div className="text-sm text-gray-500">
                          {paymentSource.bankName}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium">Initial Balance</div>
                      <div className="text-sm text-gray-500">
                        ${parseFloat(paymentSource.initialBalance || "0").toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Balance After</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.slice(0, 10).map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTransactionIcon(transaction.type)}
                            <span className="capitalize">{transaction.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{transaction.description}</div>
                          {transaction.referenceType && (
                            <div className="text-sm text-gray-500">
                              Ref: {transaction.referenceType}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className={`font-medium ${
                          transaction.type === "expense" ? "text-red-600" : "text-green-600"
                        }`}>
                          {transaction.type === "expense" ? "-" : "+"}
                          ${parseFloat(transaction.amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-medium">
                          ${parseFloat(transaction.balanceAfter).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {format(new Date(transaction.createdAt), "MMM dd, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Transactions Yet
                  </h3>
                  <p className="text-gray-500">
                    This payment source hasn't been used for any transactions.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related Expenses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Related Expenses ({expenses.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expenses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.slice(0, 10).map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>
                          <div className="font-medium">{expense.title}</div>
                          {expense.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {expense.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          ${parseFloat(expense.amount).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {expense.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {format(new Date(expense.expenseDate), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Link href={`/expenses/${expense.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Related Expenses
                  </h3>
                  <p className="text-gray-500">
                    No expenses have been linked to this payment source yet.
                  </p>
                </div>
              )}
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
              <Link href={`/payment-sources/${paymentSource.id}/edit`}>
                <Button className="w-full" variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Details
                </Button>
              </Link>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full" variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Adjust Balance
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adjust Balance</DialogTitle>
                  </DialogHeader>
                  <BalanceAdjustmentForm 
                    paymentSource={paymentSource}
                    onSuccess={() => {
                      queryClient.invalidateQueries({ 
                        queryKey: ["/api/payment-sources", id] 
                      });
                      queryClient.invalidateQueries({ 
                        queryKey: ["/api/payment-sources", id, "transactions"] 
                      });
                    }}
                  />
                </DialogContent>
              </Dialog>

              <Separator />

              <Button
                variant="destructive"
                className="w-full"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleteMutation.isPending ? "Deleting..." : "Delete Source"}
              </Button>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Transactions</span>
                <span className="font-medium">{transactions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Related Expenses</span>
                <span className="font-medium">{expenses.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Spent</span>
                <span className="font-medium text-red-600">
                  ${expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0).toLocaleString()}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-gray-600">Current Balance</span>
                <span className="font-bold text-green-600">
                  ${parseFloat(paymentSource.currentBalance || "0").toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}