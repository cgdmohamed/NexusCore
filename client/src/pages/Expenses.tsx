import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

import { useState, useMemo, useEffect } from "react";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/ui/table-pagination";
import { 
  Plus, 
  Search, 
  FileText, 
  Eye, 
  Edit, 
  DollarSign, 
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Building,
  Receipt,
  Repeat,
  Filter,
  TrendingUp,
  TrendingDown,
  PieChart
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { formatCurrency } from "@/lib/currency";
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
import { Header } from "@/components/dashboard/Header";
import { DataExportButton } from "@/components/DataExportButton";
import { ExpenseForm } from "@/components/forms/ExpenseForm";
import { Link } from "wouter";
import { useTranslation } from "@/lib/i18n";
import type { Expense, ExpenseCategory, Client } from "@shared/schema";

export default function Expenses() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("expenseDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  const { data: expenses = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: categories = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/expenses/stats?period=month"],
  });

  // Filter and sort expenses
  const filteredExpenses = useMemo(() => {
    let filtered = expenses.filter((expense) => {
      const matchesSearch = 
        expense.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.category?.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === "all" || expense.type === typeFilter;
      const matchesStatus = statusFilter === "all" || expense.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || expense.categoryId === categoryFilter;
      
      return matchesSearch && matchesType && matchesStatus && matchesCategory;
    });

    // Sort expenses
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === "amount") {
        aValue = parseFloat(aValue);
        bValue = parseFloat(bValue);
      } else if (sortBy === "expenseDate") {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [expenses, searchTerm, typeFilter, statusFilter, categoryFilter, sortBy, sortOrder]);

  const {
    currentPage: expensesPage,
    totalPages: expensesTotalPages,
    pageSize: expensesPageSize,
    paginatedItems: paginatedExpenses,
    setCurrentPage: setExpensesPage,
    setPageSize: setExpensesPageSize,
  } = usePagination(filteredExpenses);

  useEffect(() => { setExpensesPage(1); }, [searchTerm, typeFilter, statusFilter, categoryFilter, sortBy, sortOrder]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "overdue":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      paid: "bg-green-100 text-green-800 border-green-200",
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      overdue: "bg-red-100 text-red-800 border-red-200",
      cancelled: "bg-muted text-foreground border-border",
      draft: "bg-muted text-foreground border-border",
      submitted: "bg-blue-100 text-blue-800 border-blue-200",
      approved: "bg-green-100 text-green-800 border-green-200",
      rejected: "bg-red-100 text-red-800 border-red-200",
    };
    return colorMap[status] || colorMap.pending;
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant="outline" className={getStatusColor(status)}>
        <div className="flex items-center space-x-1">
          {getStatusIcon(status)}
          <span className="capitalize">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
        </div>
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    return type === "fixed" ? <Repeat className="h-4 w-4" /> : <FileText className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header 
          title={t('nav.expenses')}
          subtitle="Track and manage company expenses and payments"
        />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-muted rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header 
        title={t('nav.expenses')}
        subtitle="Track and manage company expenses and payments"
      />
      
      <div className="p-3 md:p-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Receipt className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
                  <p className="text-2xl font-bold">{stats?.totalExpenses || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Paid</p>
                  <p className="text-2xl font-bold">{stats?.paidExpenses || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{stats?.pendingExpenses || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold">{stats?.overdueExpenses || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats?.totalAmount || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingDown className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Outstanding</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats?.pendingAmount || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls and Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Expense Management</CardTitle>
          </CardHeader>
          
          <CardContent>
            {/* Search and Filter Controls */}
            <div className="flex flex-col gap-3 mb-6">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                <Input
                  placeholder="Search expenses by title, description, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="ps-10 w-full"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="variable">Variable</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                  const [field, order] = value.split('-');
                  setSortBy(field);
                  setSortOrder(order as "asc" | "desc");
                }}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expenseDate-desc">Newest First</SelectItem>
                    <SelectItem value="expenseDate-asc">Oldest First</SelectItem>
                    <SelectItem value="title-asc">Title A-Z</SelectItem>
                    <SelectItem value="title-desc">Title Z-A</SelectItem>
                    <SelectItem value="amount-desc">Highest Amount</SelectItem>
                    <SelectItem value="amount-asc">Lowest Amount</SelectItem>
                    <SelectItem value="status-asc">Status A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results Summary + Actions */}
            <div className="flex items-center justify-between mt-2">
              <p className="text-sm text-muted-foreground">
                Showing {filteredExpenses.length} of {expenses.length} expenses
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "table" ? "cards" : "table")}>
                  {viewMode === "table" ? "Card View" : "Table View"}
                </Button>
                <DataExportButton data={filteredExpenses} filename="expenses-export" type="csv" />
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 me-2" />
                      Add Expense
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[calc(100vw-2rem)] sm:w-auto max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create New Expense</DialogTitle>
                    </DialogHeader>
                    <ExpenseForm onClose={() => setIsCreateDialogOpen(false)} />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Content */}
        {viewMode === "table" ? (
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/60"
                  onClick={() => {
                    if (sortBy === "title") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("title");
                      setSortOrder("asc");
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Expense Details
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/60"
                  onClick={() => {
                    if (sortBy === "amount") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("amount");
                      setSortOrder("desc");
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Amount
                  </div>
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/60"
                  onClick={() => {
                    if (sortBy === "status") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("status");
                      setSortOrder("asc");
                    }
                  }}
                >
                  Status
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/60"
                  onClick={() => {
                    if (sortBy === "expenseDate") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("expenseDate");
                      setSortOrder("desc");
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date
                  </div>
                </TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-end">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedExpenses.map((expense) => (
                <TableRow key={expense.id} className="hover:bg-muted/60">
                  <TableCell>
                    <div>
                      <div className="font-medium text-foreground">{expense.title}</div>
                      {expense.description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {expense.description.length > 60
                            ? `${expense.description.substring(0, 60)}...`
                            : expense.description
                          }
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">
                      {formatCurrency(expense.amount)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {expense.category && (
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                        {expense.category.name}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(expense.type)}
                      <span className="capitalize">{expense.type}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(expense.status)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-foreground">
                      {format(new Date(expense.expenseDate), "MMM dd, yyyy")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(expense.expenseDate), { addSuffix: true })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground/70" />
                      <span className="text-sm capitalize">
                        {expense.paymentMethod.replace("_", " ")}
                      </span>
                    </div>
                    {expense.attachmentUrl && (
                      <div className="flex items-center gap-1 mt-1">
                        <Receipt className="h-3 w-3 text-green-600" />
                        <span className="text-xs text-green-600">Attached</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/expenses/${expense.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/expenses/${expense.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              </TableBody>
            </Table>
            
            {filteredExpenses.length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/70 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No expenses found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || typeFilter !== "all" || statusFilter !== "all" || categoryFilter !== "all"
                    ? "Try adjusting your search filters"
                    : "Get started by adding your first expense record"
                  }
                </p>
                <Button>
                  <Plus className="h-4 w-4 me-2" />
                  Add First Expense
                </Button>
              </div>
            )}
            {filteredExpenses.length > 0 && (
              <TablePagination
                currentPage={expensesPage}
                totalPages={expensesTotalPages}
                pageSize={expensesPageSize}
                totalItems={filteredExpenses.length}
                onPageChange={setExpensesPage}
                onPageSizeChange={setExpensesPageSize}
              />
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedExpenses.map((expense) => (
            <Card key={expense.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-foreground mb-1">
                      {expense.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 mb-2">
                      {getTypeIcon(expense.type)}
                      <span className="text-sm text-muted-foreground capitalize">{expense.type}</span>
                      {expense.isRecurring && (
                        <Badge variant="outline" className="text-xs">Recurring</Badge>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(expense.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">
                      {formatCurrency(expense.amount)}
                    </span>
                    {expense.category && (
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                        {expense.category.name}
                      </Badge>
                    )}
                  </div>
                  
                  {expense.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {expense.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(expense.expenseDate), "MMM dd, yyyy")}
                    </div>
                    <div className="flex items-center gap-1">
                      <CreditCard className="h-4 w-4" />
                      {expense.paymentMethod.replace("_", " ")}
                    </div>
                  </div>
                  
                  {expense.attachmentUrl && (
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <Receipt className="h-4 w-4" />
                      <span>Attachment available</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 pt-2">
                    <Link href={`/expenses/${expense.id}`}>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Eye className="h-4 w-4 me-1" />
                        View
                      </Button>
                    </Link>
                    <Link href={`/expenses/${expense.id}/edit`}>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Edit className="h-4 w-4 me-1" />
                        Edit
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {filteredExpenses.length > 0 && (
            <div className="col-span-full">
              <TablePagination
                currentPage={expensesPage}
                totalPages={expensesTotalPages}
                pageSize={expensesPageSize}
                totalItems={filteredExpenses.length}
                onPageChange={setExpensesPage}
                onPageSizeChange={setExpensesPageSize}
              />
            </div>
          )}
          {filteredExpenses.length === 0 && (
            <div className="col-span-full text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/70 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No expenses found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || typeFilter !== "all" || statusFilter !== "all" || categoryFilter !== "all"
                  ? "Try adjusting your search filters"
                  : "Get started by adding your first expense record"
                }
              </p>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 me-2" />
                    Add First Expense
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Expense</DialogTitle>
                  </DialogHeader>
                  <ExpenseForm onClose={() => setIsCreateDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
}