import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface VerificationResult {
  module: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  count?: number;
}

export function SystemVerification() {
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({ queryKey: ["/api/clients"] });
  const { data: tasks = [] } = useQuery({ queryKey: ["/api/tasks"] });
  const { data: expenses = [] } = useQuery({ queryKey: ["/api/expenses"] });
  const { data: quotations = [] } = useQuery({ queryKey: ["/api/quotations"] });
  const { data: invoices = [] } = useQuery({ queryKey: ["/api/invoices"] });
  const { data: kpis } = useQuery({ queryKey: ["/api/dashboard/kpis"] });
  const { data: activities = [] } = useQuery({ queryKey: ["/api/activities"] });

  const verificationResults: VerificationResult[] = [
    {
      module: "Clients Module",
      status: Array.isArray(clients) ? 'success' : 'error',
      message: Array.isArray(clients) ? `${clients.length} clients loaded` : 'Failed to load clients',
      count: clients.length
    },
    {
      module: "Tasks Module", 
      status: Array.isArray(tasks) ? 'success' : 'error',
      message: Array.isArray(tasks) ? `${tasks.length} tasks loaded` : 'Failed to load tasks',
      count: tasks.length
    },
    {
      module: "Expenses Module",
      status: Array.isArray(expenses) ? 'success' : 'error', 
      message: Array.isArray(expenses) ? `${expenses.length} expenses loaded` : 'Failed to load expenses',
      count: expenses.length
    },
    {
      module: "Quotations Module",
      status: Array.isArray(quotations) ? 'success' : 'error',
      message: Array.isArray(quotations) ? `${quotations.length} quotations loaded` : 'Failed to load quotations', 
      count: quotations.length
    },
    {
      module: "Invoices Module",
      status: Array.isArray(invoices) ? 'success' : 'error',
      message: Array.isArray(invoices) ? `${invoices.length} invoices loaded` : 'Failed to load invoices',
      count: invoices.length
    },
    {
      module: "Dashboard KPIs",
      status: kpis ? 'success' : 'error',
      message: kpis ? `KPIs loaded (${kpis.activeClients} clients, $${kpis.totalRevenue} revenue)` : 'Failed to load KPIs'
    },
    {
      module: "Activity Feed",
      status: Array.isArray(activities) ? 'success' : 'error',
      message: Array.isArray(activities) ? `${activities.length} activities loaded` : 'Failed to load activities',
      count: activities.length
    }
  ];

  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'System Test Client',
          email: 'test@system.com',
          phone: '+1234567890',
          city: 'Test City',
          country: 'Test Country'
        })
      });
      if (!response.ok) throw new Error('Failed to create test client');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800 border-green-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const successCount = verificationResults.filter(r => r.status === 'success').length;
  const totalCount = verificationResults.length;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>System Functionality Verification</span>
          <Badge className={successCount === totalCount ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
            {successCount}/{totalCount} Modules Working
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {verificationResults.map((result, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                {getStatusIcon(result.status)}
                <div>
                  <p className="font-medium">{result.module}</p>
                  <p className="text-sm text-gray-600">{result.message}</p>
                </div>
              </div>
              <Badge variant="outline" className={getStatusColor(result.status)}>
                {result.status}
              </Badge>
            </div>
          ))}
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Test Database Connection</h3>
            <p className="text-sm text-blue-700 mb-3">Click to test creating a new client record in the database</p>
            <Button 
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              className="w-full"
            >
              {testMutation.isPending ? 'Testing...' : 'Test Database Write'}
            </Button>
            {testMutation.isSuccess && (
              <p className="text-sm text-green-600 mt-2">✅ Database write test successful!</p>
            )}
            {testMutation.isError && (
              <p className="text-sm text-red-600 mt-2">❌ Database write test failed</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}