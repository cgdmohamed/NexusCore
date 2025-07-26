import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  TrendingUp, 
  Target, 
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  FileText
} from "lucide-react";
import { KpiForm } from "@/components/forms/KpiForm";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EmployeeKpi } from "@shared/schema";
import { format } from "date-fns";

interface EmployeeKpiTabProps {
  employeeId: string;
  employeeName: string;
}

export function EmployeeKpiTab({ employeeId, employeeName }: EmployeeKpiTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showKpiForm, setShowKpiForm] = useState(false);
  const [editingKpi, setEditingKpi] = useState<EmployeeKpi | null>(null);

  // Fetch KPIs
  const { data: kpis = [], isLoading: kpisLoading } = useQuery({
    queryKey: [`/api/employees/${employeeId}/kpis`],
  });

  // Fetch KPI statistics
  const { data: stats } = useQuery({
    queryKey: [`/api/employees/${employeeId}/kpi-stats`],
  });

  // Fetch evaluation periods
  const { data: periods = [] } = useQuery({
    queryKey: [`/api/employees/${employeeId}/kpi-periods`],
  });

  // Delete KPI mutation
  const deleteMutation = useMutation({
    mutationFn: async (kpiId: string) => {
      await apiRequest("DELETE", `/api/kpis/${kpiId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/kpis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/kpi-stats`] });
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/kpi-periods`] });
      toast({
        title: "Success",
        description: "KPI deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter KPIs
  const filteredKpis = useMemo(() => {
    return kpis.filter((kpi: EmployeeKpi) => {
      const matchesSearch = 
        kpi.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kpi.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kpi.evaluationPeriod.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesPeriod = periodFilter === "all" || kpi.evaluationPeriod === periodFilter;
      const matchesStatus = statusFilter === "all" || kpi.status === statusFilter;
      
      return matchesSearch && matchesPeriod && matchesStatus;
    });
  }, [kpis, searchTerm, periodFilter, statusFilter]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "exceeded": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "on_track": return <Target className="h-4 w-4 text-blue-600" />;
      case "below_target": return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case "not_evaluated": return <Clock className="h-4 w-4 text-gray-600" />;
      default: return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "exceeded": return "bg-green-100 text-green-800";
      case "on_track": return "bg-blue-100 text-blue-800";
      case "below_target": return "bg-orange-100 text-orange-800";
      case "not_evaluated": return "bg-gray-100 text-gray-800";
      default: return "bg-red-100 text-red-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "exceeded": return "Exceeded";
      case "on_track": return "On Track";
      case "below_target": return "Below Target";
      case "not_evaluated": return "Not Evaluated";
      default: return "Unknown";
    }
  };

  const calculateProgress = (target: string, actual: string) => {
    if (!target || !actual) return 0;
    
    // Try to extract numbers from the strings
    const targetNum = parseFloat(target.replace(/[^0-9.-]/g, ''));
    const actualNum = parseFloat(actual.replace(/[^0-9.-]/g, ''));
    
    if (isNaN(targetNum) || isNaN(actualNum) || targetNum === 0) return 0;
    
    return Math.min(Math.max((actualNum / targetNum) * 100, 0), 150); // Cap at 150%
  };

  const handleEditKpi = (kpi: EmployeeKpi) => {
    setEditingKpi(kpi);
    setShowKpiForm(true);
  };

  const handleDeleteKpi = (kpiId: string) => {
    deleteMutation.mutate(kpiId);
  };

  const closeKpiForm = () => {
    setShowKpiForm(false);
    setEditingKpi(null);
  };

  const exportKpis = () => {
    // Create CSV content
    const headers = ["Title", "Description", "Evaluation Period", "Target Value", "Actual Value", "Status", "Notes", "Created Date"];
    const csvContent = [
      headers.join(","),
      ...filteredKpis.map((kpi: EmployeeKpi) => [
        `"${kpi.title}"`,
        `"${kpi.description || ''}"`,
        `"${kpi.evaluationPeriod}"`,
        `"${kpi.targetValue || ''}"`,
        `"${kpi.actualValue || ''}"`,
        `"${getStatusText(kpi.status)}"`,
        `"${kpi.notes || ''}"`,
        `"${format(new Date(kpi.createdAt), 'yyyy-MM-dd')}"`,
      ].join(","))
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${employeeName.replace(/\s+/g, '_')}_KPIs_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "KPI data has been exported successfully",
    });
  };

  if (kpisLoading) {
    return <div className="text-center py-8">Loading KPIs...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total KPIs</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Exceeded</p>
                  <p className="text-2xl font-bold">{stats.exceeded}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">On Track</p>
                  <p className="text-2xl font-bold">{stats.onTrack}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Below Target</p>
                  <p className="text-2xl font-bold">{stats.belowTarget}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Not Evaluated</p>
                  <p className="text-2xl font-bold">{stats.notEvaluated}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 items-center flex-1">
              <div className="relative flex-1 md:max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search KPIs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Periods</SelectItem>
                    {periods.map((period: string) => (
                      <SelectItem key={period} value={period}>{period}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="exceeded">Exceeded</SelectItem>
                    <SelectItem value="on_track">On Track</SelectItem>
                    <SelectItem value="below_target">Below Target</SelectItem>
                    <SelectItem value="not_evaluated">Not Evaluated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportKpis} disabled={filteredKpis.length === 0}>
                <FileText className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              
              <Dialog open={showKpiForm} onOpenChange={setShowKpiForm}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingKpi(null)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add KPI
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingKpi ? "Edit KPI" : "Create New KPI"}
                    </DialogTitle>
                  </DialogHeader>
                  <KpiForm 
                    employeeId={employeeId} 
                    kpi={editingKpi} 
                    onClose={closeKpiForm} 
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs Grid */}
      {filteredKpis.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No KPIs Found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || periodFilter !== "all" || statusFilter !== "all" 
                ? "No KPIs match your current filters." 
                : "Start tracking performance by creating your first KPI."
              }
            </p>
            {(!searchTerm && periodFilter === "all" && statusFilter === "all") && (
              <Button onClick={() => setShowKpiForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First KPI
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredKpis.map((kpi: EmployeeKpi) => (
            <Card key={kpi.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{kpi.title}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{kpi.evaluationPeriod}</p>
                  </div>
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(kpi.status)}
                    <Badge className={getStatusColor(kpi.status)}>
                      {getStatusText(kpi.status)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {kpi.description && (
                  <p className="text-sm text-gray-700">{kpi.description}</p>
                )}
                
                {kpi.targetValue && kpi.actualValue && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{Math.round(calculateProgress(kpi.targetValue, kpi.actualValue))}%</span>
                    </div>
                    <Progress value={calculateProgress(kpi.targetValue, kpi.actualValue)} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Target: {kpi.targetValue}</span>
                      <span>Actual: {kpi.actualValue}</span>
                    </div>
                  </div>
                )}
                
                {(!kpi.targetValue || !kpi.actualValue) && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No values set for progress tracking
                  </div>
                )}
                
                {kpi.notes && (
                  <div className="text-sm">
                    <span className="font-medium">Notes: </span>
                    <span className="text-gray-700">{kpi.notes}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-xs text-gray-500">
                    {format(new Date(kpi.createdAt), 'MMM d, yyyy')}
                  </span>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditKpi(kpi)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete KPI</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{kpi.title}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteKpi(kpi.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}