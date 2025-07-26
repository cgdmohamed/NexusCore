import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { useState, useMemo } from "react";
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
  User,
  Building
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceForm } from "@/components/forms/InvoiceForm";
import { DataExportButton } from "@/components/DataExportButton";
import { Link } from "wouter";
import type { Invoice, Client } from "@shared/schema";

export default function Invoices() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const invoiceList = invoices as Invoice[];

  // Enhanced filtering and sorting
  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = invoiceList.filter(invoice => {
      const client = clients.find(c => c.id === invoice.clientId);
      const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           invoice.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           client?.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case "invoiceNumber":
          aValue = a.invoiceNumber.toLowerCase();
          bValue = b.invoiceNumber.toLowerCase();
          break;
        case "amount":
          aValue = parseFloat(a.amount || "0");
          bValue = parseFloat(b.amount || "0");
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        case "dueDate":
          aValue = a.dueDate ? new Date(a.dueDate) : new Date(0);
          bValue = b.dueDate ? new Date(b.dueDate) : new Date(0);
          break;
        default: // createdAt
          aValue = a.createdAt ? new Date(a.createdAt) : new Date(0);
          bValue = b.createdAt ? new Date(b.createdAt) : new Date(0);
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [invoiceList, clients, searchTerm, statusFilter, sortBy, sortOrder]);

  // Statistics calculations
  const stats = useMemo(() => {
    const totalAmount = invoiceList.reduce((sum, inv) => sum + parseFloat(inv.amount || "0"), 0);
    const totalPaid = invoiceList.reduce((sum, inv) => sum + parseFloat(inv.paidAmount || "0"), 0);
    const outstanding = totalAmount - totalPaid;
    
    const now = new Date();
    const overdue = invoiceList.filter(inv => 
      inv.status !== 'paid' && inv.dueDate && new Date(inv.dueDate) < now
    ).length;
    
    return {
      total: invoiceList.length,
      draft: invoiceList.filter(inv => inv.status === 'draft').length,
      sent: invoiceList.filter(inv => inv.status === 'sent').length,
      paid: invoiceList.filter(inv => inv.status === 'paid').length,
      partiallyPaid: invoiceList.filter(inv => inv.status === 'partially_paid').length,
      overdue,
      totalAmount,
      totalPaid,
      outstanding
    };
  }, [invoiceList]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 border-green-200';
      case 'partially_paid': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'sent': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'draft': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle className="w-3 h-3" />;
      case 'partially_paid': return <CreditCard className="w-3 h-3" />;
      case 'sent': return <FileText className="w-3 h-3" />;
      case 'draft': return <Edit className="w-3 h-3" />;
      case 'overdue': return <AlertCircle className="w-3 h-3" />;
      case 'cancelled': return <XCircle className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Unknown Client';
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const isOverdue = (invoice: Invoice) => {
    if (invoice.status === 'paid' || !invoice.dueDate) return false;
    return new Date(invoice.dueDate) < new Date();
  };

  return (
    <div className="space-y-6">
      <Header 
        title={t('nav.invoices')}
        subtitle="Track payments and manage invoice status"
      />
      
      <div className="p-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Paid</p>
                  <p className="text-2xl font-bold">{stats.paid}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Partial</p>
                  <p className="text-2xl font-bold">{stats.partiallyPaid}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Overdue</p>
                  <p className="text-2xl font-bold">{stats.overdue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Amount</p>
                  <p className="text-xl font-bold">${stats.totalAmount.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Building className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Outstanding</p>
                  <p className="text-xl font-bold">${stats.outstanding.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls and Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              <CardTitle className="text-lg font-semibold">Invoice Management</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <InvoiceForm />
                <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "table" ? "cards" : "table")}>
                  {viewMode === "table" ? "Card View" : "Table View"}
                </Button>
                <DataExportButton 
                  data={filteredAndSortedInvoices} 
                  filename="invoices-export" 
                  type="csv" 
                />
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search invoices by number, title, or client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                const [field, order] = value.split('-');
                setSortBy(field);
                setSortOrder(order as "asc" | "desc");
              }}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">Newest First</SelectItem>
                  <SelectItem value="createdAt-asc">Oldest First</SelectItem>
                  <SelectItem value="dueDate-asc">Due Date (Earliest)</SelectItem>
                  <SelectItem value="dueDate-desc">Due Date (Latest)</SelectItem>
                  <SelectItem value="amount-desc">Highest Amount</SelectItem>
                  <SelectItem value="amount-asc">Lowest Amount</SelectItem>
                  <SelectItem value="invoiceNumber-asc">Invoice # A-Z</SelectItem>
                  <SelectItem value="status-asc">Status A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results Info */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                Showing {filteredAndSortedInvoices.length} of {invoiceList.length} invoices
              </p>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">Loading invoices...</p>
              </div>
            ) : filteredAndSortedInvoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">
                  {invoiceList.length === 0 ? "No invoices found" : "No invoices match your filters"}
                </p>
                {invoiceList.length === 0 && (
                  <InvoiceForm trigger={
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Create your first invoice
                    </Button>
                  } />
                )}
              </div>
            ) : viewMode === "table" ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort("invoiceNumber")}
                      >
                        Invoice # {sortBy === "invoiceNumber" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort("amount")}
                      >
                        Amount {sortBy === "amount" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>Payment Progress</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort("status")}
                      >
                        Status {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort("dueDate")}
                      >
                        Due Date {sortBy === "dueDate" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort("createdAt")}
                      >
                        Created {sortBy === "createdAt" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedInvoices.map((invoice) => {
                      const amount = parseFloat(invoice.amount || "0");
                      const paid = parseFloat(invoice.paidAmount || "0");
                      const remaining = amount - paid;
                      const paymentProgress = amount > 0 ? (paid / amount) * 100 : 0;
                      
                      return (
                        <TableRow key={invoice.id} className={`hover:bg-gray-50 ${isOverdue(invoice) ? 'bg-red-50' : ''}`}>
                          <TableCell className="font-medium">
                            <Link href={`/invoices/${invoice.id}`} className="text-blue-600 hover:text-blue-800">
                              {invoice.invoiceNumber}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <User className="w-3 h-3 mr-1 text-gray-400" />
                              {getClientName(invoice.clientId)}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            ${amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Paid: ${paid.toLocaleString()}</span>
                                <span>Due: ${remaining.toLocaleString()}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-green-600 h-2 rounded-full" 
                                  style={{ width: `${Math.min(paymentProgress, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusColor(invoice.status)}>
                              <div className="flex items-center space-x-1">
                                {getStatusIcon(invoice.status)}
                                <span className="capitalize">{invoice.status.replace('_', ' ')}</span>
                              </div>
                            </Badge>
                          </TableCell>
                          <TableCell className={isOverdue(invoice) ? 'text-red-600 font-medium' : 'text-sm text-gray-600'}>
                            <div>
                              <div>{invoice.dueDate ? format(new Date(invoice.dueDate), 'MMM dd, yyyy') : 'No due date'}</div>
                              {invoice.dueDate && (
                                <div className="text-xs text-gray-400">
                                  {formatDistanceToNow(new Date(invoice.dueDate), { addSuffix: true })}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            <div>
                              <div>{invoice.createdAt ? format(new Date(invoice.createdAt), 'MMM dd, yyyy') : 'Unknown'}</div>
                              <div className="text-xs text-gray-400">
                                {invoice.createdAt ? formatDistanceToNow(new Date(invoice.createdAt), { addSuffix: true }) : ''}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link href={`/invoices/${invoice.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="w-3 h-3 mr-1" />
                                View
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              /* Card View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAndSortedInvoices.map((invoice) => {
                  const amount = parseFloat(invoice.amount || "0");
                  const paid = parseFloat(invoice.paidAmount || "0");
                  const remaining = amount - paid;
                  const paymentProgress = amount > 0 ? (paid / amount) * 100 : 0;
                  
                  return (
                    <Card key={invoice.id} className={`hover:shadow-md transition-shadow ${isOverdue(invoice) ? 'border-red-200 bg-red-50' : ''}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <Link href={`/invoices/${invoice.id}`} className="text-blue-600 hover:text-blue-800">
                              <CardTitle className="text-lg">{invoice.invoiceNumber}</CardTitle>
                            </Link>
                            <div className="flex items-center text-sm text-gray-600 mt-1">
                              <User className="w-3 h-3 mr-1" />
                              {getClientName(invoice.clientId)}
                            </div>
                          </div>
                          <Badge variant="outline" className={getStatusColor(invoice.status)}>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(invoice.status)}
                              <span className="capitalize">{invoice.status.replace('_', ' ')}</span>
                            </div>
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          {/* Amount and Payment Progress */}
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-600">Amount</span>
                              <span className="text-lg font-bold">${amount.toLocaleString()}</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-green-600">Paid: ${paid.toLocaleString()}</span>
                                <span className="text-red-600">Due: ${remaining.toLocaleString()}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-green-600 h-2 rounded-full" 
                                  style={{ width: `${Math.min(paymentProgress, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>

                          {/* Due Date */}
                          <div className="pt-2 border-t border-gray-100">
                            <div className={`flex items-center text-xs ${isOverdue(invoice) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                              <Calendar className="w-3 h-3 mr-1" />
                              Due: {invoice.dueDate ? format(new Date(invoice.dueDate), 'MMM dd, yyyy') : 'No due date'}
                            </div>
                            {invoice.dueDate && (
                              <div className="text-xs text-gray-400 ml-4">
                                {formatDistanceToNow(new Date(invoice.dueDate), { addSuffix: true })}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <Link href={`/invoices/${invoice.id}`} className="w-full block">
                            <Button variant="outline" size="sm" className="w-full">
                              <Eye className="w-3 h-3 mr-1" />
                              View Details
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
