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
  Users, 
  Eye, 
  Edit, 
  MapPin, 
  Mail, 
  Phone, 
  DollarSign, 
  TrendingUp,
  UserCheck,
  Clock,
  UserX,
  Calendar,
  Building,
  Globe
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
import { ClientForm } from "@/components/forms/ClientForm";
import { StatusUpdateForm } from "@/components/forms/StatusUpdateForm";
import { DataExportButton } from "@/components/DataExportButton";
import { Link } from "wouter";
import type { Client, Quotation, Invoice } from "@shared/schema";

export default function CRM() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  
  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: quotations = [] } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"],
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const clientList = clients as Client[];

  // Enhanced filtering and sorting
  const filteredAndSortedClients = useMemo(() => {
    let filtered = clientList.filter(client => {
      const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           client.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           client.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           client.country?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || client.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "totalValue":
          aValue = parseFloat(a.totalValue || "0");
          bValue = parseFloat(b.totalValue || "0");
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        case "city":
          aValue = (a.city || "").toLowerCase();
          bValue = (b.city || "").toLowerCase();
          break;
        case "country":
          aValue = (a.country || "").toLowerCase();
          bValue = (b.country || "").toLowerCase();
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
  }, [clientList, searchTerm, statusFilter, sortBy, sortOrder]);

  // Statistics calculations
  const stats = useMemo(() => {
    const totalValue = clientList.reduce((sum, c) => sum + parseFloat(c.totalValue || "0"), 0);
    const avgValue = clientList.length > 0 ? totalValue / clientList.length : 0;
    
    return {
      total: clientList.length,
      active: clientList.filter(c => c.status === 'active').length,
      inactive: clientList.filter(c => c.status === 'inactive').length,
      lead: clientList.filter(c => c.status === 'lead').length,
      totalValue,
      avgValue,
      totalQuotations: quotations.length,
      totalInvoices: invoices.length
    };
  }, [clientList, quotations, invoices]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'lead': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'prospect': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'lost': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <UserCheck className="w-3 h-3" />;
      case 'inactive': return <Clock className="w-3 h-3" />;
      case 'lead': return <Users className="w-3 h-3" />;
      case 'prospect': return <TrendingUp className="w-3 h-3" />;
      case 'lost': return <UserX className="w-3 h-3" />;
      default: return <Users className="w-3 h-3" />;
    }
  };

  const getClientQuotations = (clientId: string) => {
    return quotations.filter(q => q.clientId === clientId);
  };

  const getClientInvoices = (clientId: string) => {
    return invoices.filter(i => i.clientId === clientId);
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
        title={t('nav.crm')}
        subtitle="Manage your client relationships and opportunities"
      />
      
      <div className="p-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Clients</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <UserCheck className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Leads</p>
                  <p className="text-2xl font-bold">{stats.lead}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Inactive</p>
                  <p className="text-2xl font-bold">{stats.inactive}</p>
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
                  <p className="text-xl font-bold">${stats.totalValue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Building className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Value</p>
                  <p className="text-xl font-bold">${Math.round(stats.avgValue).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls and Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              <CardTitle className="text-lg font-semibold">Client Relationship Management</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <ClientForm />
                <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "table" ? "cards" : "table")}>
                  {viewMode === "table" ? "Card View" : "Table View"}
                </Button>
                <DataExportButton 
                  data={filteredAndSortedClients} 
                  filename="clients-export" 
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
                  placeholder="Search clients by name, email, phone, or location..."
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
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
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
                  <SelectItem value="name-asc">Name A-Z</SelectItem>
                  <SelectItem value="name-desc">Name Z-A</SelectItem>
                  <SelectItem value="totalValue-desc">Highest Value</SelectItem>
                  <SelectItem value="totalValue-asc">Lowest Value</SelectItem>
                  <SelectItem value="status-asc">Status A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results Info */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                Showing {filteredAndSortedClients.length} of {clientList.length} clients
              </p>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">Loading clients...</p>
              </div>
            ) : filteredAndSortedClients.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">
                  {clientList.length === 0 ? "No clients found" : "No clients match your filters"}
                </p>
                {clientList.length === 0 && (
                  <ClientForm trigger={
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add your first client
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
                        onClick={() => toggleSort("name")}
                      >
                        Client Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>Contact Information</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort("city")}
                      >
                        Location {sortBy === "city" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort("status")}
                      >
                        Status {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort("totalValue")}
                      >
                        Total Value {sortBy === "totalValue" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>Business Activity</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort("createdAt")}
                      >
                        Joined {sortBy === "createdAt" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedClients.map((client) => {
                      const clientQuotations = getClientQuotations(client.id);
                      const clientInvoices = getClientInvoices(client.id);
                      
                      return (
                        <TableRow key={client.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">
                            <Link href={`/crm/${client.id}`} className="text-blue-600 hover:text-blue-800">
                              {client.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {client.email && (
                                <div className="flex items-center text-sm text-gray-600">
                                  <Mail className="w-3 h-3 mr-1" />
                                  {client.email}
                                </div>
                              )}
                              {client.phone && (
                                <div className="flex items-center text-sm text-gray-600">
                                  <Phone className="w-3 h-3 mr-1" />
                                  {client.phone}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            <div className="flex items-center">
                              <MapPin className="w-3 h-3 mr-1" />
                              {client.city}, {client.country}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusColor(client.status)}>
                              <div className="flex items-center space-x-1">
                                {getStatusIcon(client.status)}
                                <span className="capitalize">{client.status}</span>
                              </div>
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            ${parseFloat(client.totalValue || "0").toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            <div className="space-y-1">
                              <div>{clientQuotations.length} quotations</div>
                              <div>{clientInvoices.length} invoices</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            <div>
                              <div>{client.createdAt ? format(new Date(client.createdAt), 'MMM dd, yyyy') : 'Unknown'}</div>
                              <div className="text-xs text-gray-400">
                                {client.createdAt ? formatDistanceToNow(new Date(client.createdAt), { addSuffix: true }) : ''}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Link href={`/crm/${client.id}`}>
                                <Button variant="outline" size="sm">
                                  <Eye className="w-3 h-3 mr-1" />
                                  View
                                </Button>
                              </Link>
                              <StatusUpdateForm
                                entityType="client"
                                entityId={client.id}
                                currentStatus={client.status}
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
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              /* Card View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAndSortedClients.map((client) => {
                  const clientQuotations = getClientQuotations(client.id);
                  const clientInvoices = getClientInvoices(client.id);
                  
                  return (
                    <Card key={client.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <Link href={`/crm/${client.id}`} className="text-blue-600 hover:text-blue-800">
                              <CardTitle className="text-lg">{client.name}</CardTitle>
                            </Link>
                            <div className="flex items-center text-sm text-gray-600 mt-1">
                              <MapPin className="w-3 h-3 mr-1" />
                              {client.city}, {client.country}
                            </div>
                          </div>
                          <Badge variant="outline" className={getStatusColor(client.status)}>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(client.status)}
                              <span className="capitalize">{client.status}</span>
                            </div>
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          {/* Contact Info */}
                          <div className="space-y-1">
                            {client.email && (
                              <div className="flex items-center text-sm text-gray-600">
                                <Mail className="w-3 h-3 mr-2" />
                                {client.email}
                              </div>
                            )}
                            {client.phone && (
                              <div className="flex items-center text-sm text-gray-600">
                                <Phone className="w-3 h-3 mr-2" />
                                {client.phone}
                              </div>
                            )}
                          </div>

                          {/* Business Metrics */}
                          <div className="grid grid-cols-2 gap-4 py-2 border-t border-gray-100">
                            <div>
                              <p className="text-xs text-gray-500">Total Value</p>
                              <p className="text-lg font-bold">${parseFloat(client.totalValue || "0").toLocaleString()}</p>
                              {parseFloat(client.creditBalance || "0") > 0 && (
                                <p className="text-xs text-green-600 font-medium">
                                  Credit: ${parseFloat(client.creditBalance || "0").toLocaleString()}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Activity</p>
                              <p className="text-sm font-medium">{clientQuotations.length}Q / {clientInvoices.length}I</p>
                            </div>
                          </div>

                          {/* Member Since */}
                          <div className="pt-2 border-t border-gray-100">
                            <div className="flex items-center text-xs text-gray-500">
                              <Calendar className="w-3 h-3 mr-1" />
                              Member since {client.createdAt ? format(new Date(client.createdAt), 'MMM yyyy') : 'Unknown'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2 mt-4">
                          <Link href={`/crm/${client.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full">
                              <Eye className="w-3 h-3 mr-1" />
                              View Profile
                            </Button>
                          </Link>
                          <StatusUpdateForm
                            entityType="client"
                            entityId={client.id}
                            currentStatus={client.status}
                            trigger={
                              <Button variant="outline" size="sm">
                                <Edit className="w-3 h-3" />
                              </Button>
                            }
                          />
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
