import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { useState, useMemo } from "react";
import { 
  Plus, 
  Search, 
  Wallet, 
  Building, 
  Banknote,
  Eye, 
  Edit, 
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  Filter,
  MoreHorizontal,
  Settings
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PaymentSourceForm } from "@/components/forms/PaymentSourceForm";
import { BalanceAdjustmentForm } from "@/components/forms/BalanceAdjustmentForm";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PaymentSource } from "@shared/schema";

export default function PaymentSources() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<PaymentSource | null>(null);

  const { data: paymentSources = [], isLoading } = useQuery<PaymentSource[]>({
    queryKey: ["/api/payment-sources"],
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/payment-sources/stats"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/payment-sources/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payment source deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-sources"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete payment source",
        variant: "destructive",
      });
    },
  });

  // Filter and sort payment sources
  const filteredSources = useMemo(() => {
    let filtered = paymentSources.filter((source) => {
      const matchesSearch = 
        source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        source.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === "all" || source.accountType === typeFilter;
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && source.isActive) ||
        (statusFilter === "inactive" && !source.isActive);
      
      return matchesSearch && matchesType && matchesStatus;
    });

    // Sort sources
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy as keyof PaymentSource];
      let bValue: any = b[sortBy as keyof PaymentSource];
      
      if (sortBy === "currentBalance") {
        aValue = parseFloat(a.currentBalance);
        bValue = parseFloat(b.currentBalance);
      }
      
      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [paymentSources, searchTerm, typeFilter, statusFilter, sortBy, sortOrder]);

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'cash': return <Banknote className="w-4 h-4" />;
      case 'bank': return <Building className="w-4 h-4" />;
      case 'wallet': return <Wallet className="w-4 h-4" />;
      default: return <CreditCard className="w-4 h-4" />;
    }
  };

  const getAccountTypeBadge = (type: string) => {
    const variants = {
      cash: "default",
      bank: "secondary", 
      wallet: "outline"
    } as const;
    
    return (
      <Badge variant={variants[type as keyof typeof variants] || "outline"}>
        <span className="flex items-center gap-1">
          {getAccountTypeIcon(type)}
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </span>
      </Badge>
    );
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const handleDelete = (source: PaymentSource) => {
    if (window.confirm(`Are you sure you want to delete "${source.name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(source.id);
    }
  };

  const handleAdjustBalance = (source: PaymentSource) => {
    setSelectedSource(source);
    setIsAdjustDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header 
          title={t('nav.payments')}
          subtitle="Manage company financial accounts and track balances"
        />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
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
        title={t('nav.payments')}
        subtitle="Manage company financial accounts and track balances"
      />
      
      <div className="p-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Wallet className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Sources</p>
                  <p className="text-2xl font-bold">{stats?.totalSources || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Sources</p>
                  <p className="text-2xl font-bold">{stats?.activeSources || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Balance</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats?.totalBalance || "0")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search payment sources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Account Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="wallet">Wallet</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === "table" ? "cards" : "table")}
            >
              {viewMode === "table" ? "Card View" : "Table View"}
            </Button>
            
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Payment Source
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Payment Source</DialogTitle>
                </DialogHeader>
                <PaymentSourceForm onClose={() => setIsCreateDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Results Summary */}
        <div className="text-sm text-gray-600">
          {filteredSources.length} of {paymentSources.length} payment sources
        </div>

        {/* Payment Sources Display */}
        {viewMode === "table" ? (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleSort("name")}
                  >
                    Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleSort("currentBalance")}
                  >
                    Balance {sortBy === "currentBalance" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSources.map((source) => (
                  <TableRow key={source.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div>
                        <Link href={`/payment-sources/${source.id}`} className="font-medium hover:text-blue-600">
                          {source.name}
                        </Link>
                        {source.description && (
                          <p className="text-sm text-gray-500 mt-1">{source.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getAccountTypeBadge(source.accountType)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatCurrency(source.currentBalance)}
                    </TableCell>
                    <TableCell>{source.currency}</TableCell>
                    <TableCell>
                      <Badge variant={source.isActive ? "default" : "secondary"}>
                        {source.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatDistanceToNow(new Date(source.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <Link href={`/payment-sources/${source.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/payment-sources/${source.id}/edit`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAdjustBalance(source)}>
                            <Settings className="h-4 w-4 mr-2" />
                            Adjust Balance
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(source)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSources.map((source) => (
              <Card key={source.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        <Link href={`/payment-sources/${source.id}`} className="hover:text-blue-600">
                          {source.name}
                        </Link>
                      </CardTitle>
                      {source.description && (
                        <p className="text-sm text-gray-500 mt-1">{source.description}</p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/payment-sources/${source.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/payment-sources/${source.id}/edit`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAdjustBalance(source)}>
                          <Settings className="h-4 w-4 mr-2" />
                          Adjust Balance
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDelete(source)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    {getAccountTypeBadge(source.accountType)}
                    <Badge variant={source.isActive ? "default" : "secondary"}>
                      {source.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Current Balance:</span>
                      <span className="font-mono font-semibold text-lg">
                        {formatCurrency(source.currentBalance)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Currency:</span>
                      <span className="text-sm">{source.currency}</span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 pt-2 border-t">
                    Created {formatDistanceToNow(new Date(source.createdAt), { addSuffix: true })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {filteredSources.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Payment Sources Found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || typeFilter !== "all" || statusFilter !== "all"
                  ? "No payment sources match your current filters."
                  : "Get started by adding your first payment source."}
              </p>
              {(!searchTerm && typeFilter === "all" && statusFilter === "all") && (
                <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Payment Source
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Balance Adjustment Dialog */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Balance - {selectedSource?.name}</DialogTitle>
          </DialogHeader>
          {selectedSource && (
            <BalanceAdjustmentForm 
              paymentSource={selectedSource}
              onClose={() => {
                setIsAdjustDialogOpen(false);
                setSelectedSource(null);
              }} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}