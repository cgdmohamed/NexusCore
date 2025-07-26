import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Eye, FileText, DollarSign, Clock, CheckCircle, XCircle, RefreshCw, Users, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Quotation, Client } from "@shared/schema";

export default function QuotationManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quotations = [], isLoading } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ quotationIds, status }: { quotationIds: string[], status: string }) => {
      const promises = quotationIds.map(id => 
        apiRequest(`/api/quotations/${id}`, "PATCH", { status })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({
        title: "Status updated",
        description: "Selected quotations have been updated successfully.",
      });
    },
  });

  // Statistics calculations
  const stats = {
    total: quotations.length,
    draft: quotations.filter(q => q.status === 'draft').length,
    sent: quotations.filter(q => q.status === 'sent').length,
    accepted: quotations.filter(q => q.status === 'accepted').length,
    rejected: quotations.filter(q => q.status === 'rejected').length,
    invoiced: quotations.filter(q => q.status === 'invoiced').length,
    totalValue: quotations.reduce((sum, q) => sum + parseFloat(q.amount), 0),
    acceptedValue: quotations.filter(q => q.status === 'accepted').reduce((sum, q) => sum + parseFloat(q.amount), 0),
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'invoiced': return 'bg-purple-100 text-purple-800';
      case 'expired': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Unknown Client';
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quotation Management</h1>
          <p className="text-gray-600">Manage and review all quotations</p>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Quotations</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Accepted</p>
                <p className="text-2xl font-bold">{stats.accepted}</p>
                <p className="text-xs text-gray-500">${stats.acceptedValue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold">{stats.sent}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-2xl font-bold">${stats.totalValue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
              <div className="text-sm text-gray-500">Draft</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.sent}</div>
              <div className="text-sm text-gray-500">Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.accepted}</div>
              <div className="text-sm text-gray-500">Accepted</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
              <div className="text-sm text-gray-500">Rejected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.invoiced}</div>
              <div className="text-sm text-gray-500">Invoiced</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {stats.accepted > 0 ? ((stats.accepted / stats.total) * 100).toFixed(1) : 0}%
              </div>
              <div className="text-sm text-gray-500">Success Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quotations Table */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Quotations ({stats.total})</TabsTrigger>
          <TabsTrigger value="draft">Draft ({stats.draft})</TabsTrigger>
          <TabsTrigger value="sent">Sent ({stats.sent})</TabsTrigger>
          <TabsTrigger value="accepted">Accepted ({stats.accepted})</TabsTrigger>
          <TabsTrigger value="pending-review">Needs Review</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <QuotationTable 
            quotations={quotations} 
            clients={clients} 
            getStatusColor={getStatusColor}
            getClientName={getClientName}
          />
        </TabsContent>

        <TabsContent value="draft" className="space-y-4">
          <QuotationTable 
            quotations={quotations.filter(q => q.status === 'draft')} 
            clients={clients} 
            getStatusColor={getStatusColor}
            getClientName={getClientName}
          />
        </TabsContent>

        <TabsContent value="sent" className="space-y-4">
          <QuotationTable 
            quotations={quotations.filter(q => q.status === 'sent')} 
            clients={clients} 
            getStatusColor={getStatusColor}
            getClientName={getClientName}
          />
        </TabsContent>

        <TabsContent value="accepted" className="space-y-4">
          <QuotationTable 
            quotations={quotations.filter(q => q.status === 'accepted')} 
            clients={clients} 
            getStatusColor={getStatusColor}
            getClientName={getClientName}
          />
        </TabsContent>

        <TabsContent value="pending-review" className="space-y-4">
          <QuotationTable 
            quotations={quotations.filter(q => ['sent', 'accepted'].includes(q.status))} 
            clients={clients} 
            getStatusColor={getStatusColor}
            getClientName={getClientName}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface QuotationTableProps {
  quotations: Quotation[];
  clients: Client[];
  getStatusColor: (status: string) => string;
  getClientName: (clientId: string) => string;
}

function QuotationTable({ quotations, clients, getStatusColor, getClientName }: QuotationTableProps) {
  if (quotations.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No quotations found for this filter.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quotation</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotations.map((quotation) => (
              <TableRow key={quotation.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{quotation.quotationNumber}</p>
                    <p className="text-sm text-gray-600">{quotation.title}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Link href={`/crm/${quotation.clientId}`} className="hover:underline text-blue-600">
                    {getClientName(quotation.clientId)}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  ${parseFloat(quotation.amount).toFixed(2)}
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(quotation.status)}>
                    {quotation.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {quotation.validUntil ? formatDistanceToNow(new Date(quotation.validUntil), { addSuffix: true }) : 'No expiry'}
                </TableCell>
                <TableCell>
                  {quotation.createdAt ? formatDistanceToNow(new Date(quotation.createdAt), { addSuffix: true }) : 'No date'}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Link href={`/quotations/${quotation.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}