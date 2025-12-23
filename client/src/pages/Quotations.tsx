import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { useState, useMemo } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Download, 
  Edit, 
  FileText, 
  DollarSign, 
  Clock, 
  TrendingUp,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw
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
import { QuotationForm } from "@/components/forms/QuotationForm";
import { StatusUpdateForm } from "@/components/forms/StatusUpdateForm";
import { DataExportButton } from "@/components/DataExportButton";
import { Link } from "wouter";
import type { Quotation, Client } from "@shared/schema";

export default function Quotations() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  
  const { data: quotations = [], isLoading } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const quotationList = quotations as Quotation[];

  // Enhanced filtering and sorting
  const filteredAndSortedQuotations = useMemo(() => {
    let filtered = quotationList.filter(quotation => {
      const matchesSearch = quotation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           quotation.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           getClientName(quotation.clientId).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || quotation.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case "amount":
          aValue = parseFloat(a.amount);
          bValue = parseFloat(b.amount);
          break;
        case "title":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        case "validUntil":
          aValue = a.validUntil ? new Date(a.validUntil) : new Date(0);
          bValue = b.validUntil ? new Date(b.validUntil) : new Date(0);
          break;
        default: // createdAt
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [quotationList, searchTerm, statusFilter, sortBy, sortOrder, clients]);

  // Statistics calculations
  const stats = useMemo(() => ({
    total: quotationList.length,
    draft: quotationList.filter(q => q.status === 'draft').length,
    sent: quotationList.filter(q => q.status === 'sent').length,
    accepted: quotationList.filter(q => q.status === 'accepted').length,
    rejected: quotationList.filter(q => q.status === 'rejected').length,
    invoiced: quotationList.filter(q => q.status === 'invoiced').length,
    totalValue: quotationList.reduce((sum, q) => sum + parseFloat(q.amount), 0),
    acceptedValue: quotationList.filter(q => q.status === 'accepted').reduce((sum, q) => sum + parseFloat(q.amount), 0),
    avgValue: quotationList.length > 0 ? quotationList.reduce((sum, q) => sum + parseFloat(q.amount), 0) / quotationList.length : 0
  }), [quotationList]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'sent': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'accepted': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'invoiced': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'expired': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Edit className="w-3 h-3" />;
      case 'sent': return <RefreshCw className="w-3 h-3" />;
      case 'accepted': return <CheckCircle className="w-3 h-3" />;
      case 'rejected': return <XCircle className="w-3 h-3" />;
      case 'invoiced': return <DollarSign className="w-3 h-3" />;
      case 'expired': return <AlertCircle className="w-3 h-3" />;
      default: return <FileText className="w-3 h-3" />;
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

  return (
    <div className="space-y-6">
      <Header 
        title={t('nav.quotations')}
        subtitle="Create and manage quotations for your clients"
      />
      
      <div className="p-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Edit className="h-4 w-4 text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Draft</p>
                  <p className="text-2xl font-bold">{stats.draft}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Sent</p>
                  <p className="text-2xl font-bold">{stats.sent}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Accepted</p>
                  <p className="text-2xl font-bold">{stats.accepted}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Value</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.totalValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Value</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.avgValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls and Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              <CardTitle className="text-lg font-semibold">Quotations Management</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <QuotationForm />
                <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "table" ? "cards" : "table")}>
                  {viewMode === "table" ? "Card View" : "Table View"}
                </Button>
                <DataExportButton 
                  data={filteredAndSortedQuotations} 
                  filename="quotations-export" 
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
                  placeholder="Search quotations by title, number, or client..."
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
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="invoiced">Invoiced</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
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
                  <SelectItem value="amount-desc">Highest Amount</SelectItem>
                  <SelectItem value="amount-asc">Lowest Amount</SelectItem>
                  <SelectItem value="title-asc">Title A-Z</SelectItem>
                  <SelectItem value="title-desc">Title Z-A</SelectItem>
                  <SelectItem value="status-asc">Status A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results Info */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                Showing {filteredAndSortedQuotations.length} of {quotationList.length} quotations
              </p>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">Loading quotations...</p>
              </div>
            ) : filteredAndSortedQuotations.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">
                  {quotationList.length === 0 ? "No quotations found" : "No quotations match your filters"}
                </p>
                {quotationList.length === 0 && (
                  <QuotationForm trigger={
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Create your first quotation
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
                        onClick={() => toggleSort("quotationNumber")}
                      >
                        Quotation # {sortBy === "quotationNumber" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort("title")}
                      >
                        Title {sortBy === "title" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort("amount")}
                      >
                        Amount {sortBy === "amount" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort("status")}
                      >
                        Status {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort("validUntil")}
                      >
                        Valid Until {sortBy === "validUntil" && (sortOrder === "asc" ? "↑" : "↓")}
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
                    {filteredAndSortedQuotations.map((quotation) => (
                      <TableRow key={quotation.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">
                          <Link href={`/quotations/${quotation.id}`} className="text-blue-600 hover:text-blue-800">
                            {quotation.quotationNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-48">
                          <div className="truncate" title={quotation.title}>
                            {quotation.title}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {getClientName(quotation.clientId)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(quotation.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(quotation.status)}>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(quotation.status)}
                              <span className="capitalize">{quotation.status}</span>
                            </div>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {quotation.validUntil ? (
                            <div>
                              <div>{format(new Date(quotation.validUntil), 'MMM dd, yyyy')}</div>
                              <div className="text-xs text-gray-400">
                                {formatDistanceToNow(new Date(quotation.validUntil), { addSuffix: true })}
                              </div>
                            </div>
                          ) : (
                            'No expiry'
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          <div>
                            <div>{format(new Date(quotation.createdAt), 'MMM dd, yyyy')}</div>
                            <div className="text-xs text-gray-400">
                              {formatDistanceToNow(new Date(quotation.createdAt), { addSuffix: true })}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            <Link href={`/quotations/${quotation.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="w-3 h-3 mr-1" />
                                View
                              </Button>
                            </Link>
                            <StatusUpdateForm
                              entityType="quotation"
                              entityId={quotation.id}
                              currentStatus={quotation.status}
                              trigger={
                                <Button variant="outline" size="sm">
                                  <Edit className="w-3 h-3 mr-1" />
                                  Status
                                </Button>
                              }
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              /* Card View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAndSortedQuotations.map((quotation) => (
                  <Card key={quotation.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <Link href={`/quotations/${quotation.id}`} className="text-blue-600 hover:text-blue-800">
                            <CardTitle className="text-lg">{quotation.quotationNumber}</CardTitle>
                          </Link>
                          <p className="text-sm text-gray-600 mt-1">{quotation.title}</p>
                        </div>
                        <Badge variant="outline" className={getStatusColor(quotation.status)}>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(quotation.status)}
                            <span className="capitalize">{quotation.status}</span>
                          </div>
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Client:</span>
                          <span className="text-sm font-medium">{getClientName(quotation.clientId)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Amount:</span>
                          <span className="text-lg font-bold">{formatCurrency(quotation.amount)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Valid Until:</span>
                          <span className="text-sm">
                            {quotation.validUntil ? format(new Date(quotation.validUntil), 'MMM dd, yyyy') : 'No expiry'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Created:</span>
                          <span className="text-sm">{formatDistanceToNow(new Date(quotation.createdAt), { addSuffix: true })}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2 mt-4">
                        <Link href={`/quotations/${quotation.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            <Eye className="w-3 h-3 mr-1" />
                            View Details
                          </Button>
                        </Link>
                        <StatusUpdateForm
                          entityType="quotation"
                          entityId={quotation.id}
                          currentStatus={quotation.status}
                          trigger={
                            <Button variant="outline" size="sm">
                              <Edit className="w-3 h-3" />
                            </Button>
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
