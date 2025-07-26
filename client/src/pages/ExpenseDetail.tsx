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
  DollarSign
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
// Simple inline header for now
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: expense, isLoading } = useQuery({
    queryKey: ["/api/expenses", id],
    enabled: !!id,
  });

  const { data: categories } = useQuery({
    queryKey: ["/api/expense-categories"],
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
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
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

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "outline",
      submitted: "secondary", 
      approved: "default",
      rejected: "destructive"
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getCategoryInfo = (categoryId: string) => {
    if (!categories) return null;
    return categories.find((cat: any) => cat.id === categoryId);
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this expense? This action cannot be undone.")) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Loading...</h1>
          <p className="text-gray-600 mt-1">Please wait while we load the expense details</p>
        </div>
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
        <div className="border-b border-gray-200 pb-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Expense Not Found</h1>
          <p className="text-gray-600 mt-1">The requested expense could not be found</p>
        </div>
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Expense Not Found</h3>
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
      <div className="border-b border-gray-200 pb-4 mb-6">
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
          <Link href="/expenses" className="hover:text-gray-700">Expenses</Link>
          <span className="mx-2">→</span>
          <span className="text-gray-900 font-medium">{expense.title}</span>
        </nav>
        <h1 className="text-3xl font-bold text-gray-900">{expense.title}</h1>
        <p className="text-gray-600 mt-1">Expense #{expense.id.slice(0, 8)}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                    {expense.type.charAt(0).toUpperCase() + expense.type.slice(1)} Expense
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {expense.description && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Description</h4>
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
                            style={{ backgroundColor: categoryInfo.color }}
                          />
                          <span className="text-sm text-gray-500">{categoryInfo.name}</span>
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
                        {expense.submittedBy || "Unknown"}
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

                  {expense.projectId && (
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-medium">Project</div>
                        <div className="text-sm text-gray-500">
                          Project #{expense.projectId.slice(0, 8)}
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
                  <span className="font-medium">${parseFloat(expense.amount).toLocaleString()}</span>
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