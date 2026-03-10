import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  const { data: kpis = [], isLoading: kpisLoading } = useQuery({
    queryKey: [`/api/employees/${employeeId}/kpis`],
  });
  const { data: stats } = useQuery({
    queryKey: [`/api/employees/${employeeId}/kpi-stats`],
  });
  const { data: periods = [] } = useQuery({
    queryKey: [`/api/employees/${employeeId}/kpi-periods`],
  });

  const deleteMutation = useMutation({
    mutationFn: async (kpiId: string) => {
      await apiRequest("DELETE", `/api/kpis/${kpiId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/kpis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/kpi-stats`] });
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/kpi-periods`] });
      toast({ title: "Success", description: "KPI deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

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
      case "exceeded": return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
      case "on_track": return <Target className="h-3.5 w-3.5 text-blue-600" />;
      case "below_target": return <AlertCircle className="h-3.5 w-3.5 text-orange-500" />;
      case "not_evaluated": return <Clock className="h-3.5 w-3.5 text-gray-500" />;
      default: return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "exceeded": return "bg-green-100 text-green-800";
      case "on_track": return "bg-blue-100 text-blue-800";
      case "below_target": return "bg-orange-100 text-orange-800";
      case "not_evaluated": return "bg-gray-100 text-gray-600";
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
    const targetNum = parseFloat(target.replace(/[^0-9.-]/g, ''));
    const actualNum = parseFloat(actual.replace(/[^0-9.-]/g, ''));
    if (isNaN(targetNum) || isNaN(actualNum) || targetNum === 0) return 0;
    return Math.min(Math.max((actualNum / targetNum) * 100, 0), 150);
  };

  const handleEditKpi = (kpi: EmployeeKpi) => { setEditingKpi(kpi); setShowKpiForm(true); };
  const handleDeleteKpi = (kpiId: string) => { deleteMutation.mutate(kpiId); };
  const closeKpiForm = () => { setShowKpiForm(false); setEditingKpi(null); };

  const exportKpis = () => {
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

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${employeeName.replace(/\s+/g, '_')}_KPIs_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast({ title: "Export Complete", description: "KPI data has been exported successfully" });
  };

  if (kpisLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const statItems = [
    { label: "Total KPIs", value: stats?.total, icon: TrendingUp, accent: "border-t-blue-500", iconColor: "text-blue-500" },
    { label: "Exceeded", value: stats?.exceeded, icon: CheckCircle2, accent: "border-t-green-500", iconColor: "text-green-500" },
    { label: "On Track", value: stats?.onTrack, icon: Target, accent: "border-t-blue-400", iconColor: "text-blue-400" },
    { label: "Below Target", value: stats?.belowTarget, icon: AlertCircle, accent: "border-t-orange-500", iconColor: "text-orange-500" },
    { label: "Not Evaluated", value: stats?.notEvaluated, icon: Clock, accent: "border-t-gray-400", iconColor: "text-gray-400" },
  ];

  return (
    <div className="space-y-5">

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {statItems.map(({ label, value, icon: Icon, accent, iconColor }) => (
            <Card key={label} className={`border-t-2 ${accent}`}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 leading-tight">{label}</p>
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
                </div>
                <p className="text-2xl font-bold text-text">{value ?? 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter + Actions Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 min-w-0 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search KPIs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9"
            />
          </div>

          {/* Period filter */}
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-full sm:w-36 h-9">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Periods</SelectItem>
              {periods.map((period: string) => (
                <SelectItem key={period} value={period}>{period}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-36 h-9">
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

        {/* Actions */}
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={exportKpis} disabled={filteredKpis.length === 0}>
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => { setEditingKpi(null); setShowKpiForm(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add KPI
          </Button>
        </div>
      </div>

      {/* KPIs Grid */}
      {filteredKpis.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <TrendingUp className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium mb-1">No KPIs Found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchTerm || periodFilter !== "all" || statusFilter !== "all"
                ? "No KPIs match your current filters."
                : "Start tracking performance by creating your first KPI."}
            </p>
            {!searchTerm && periodFilter === "all" && statusFilter === "all" && (
              <Button size="sm" onClick={() => setShowKpiForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First KPI
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredKpis.map((kpi: EmployeeKpi) => {
            const progress = calculateProgress(kpi.targetValue || "", kpi.actualValue || "");
            const hasValues = kpi.targetValue && kpi.actualValue;

            return (
              <Card key={kpi.id} className="hover:shadow-md transition-shadow flex flex-col">
                {/* Card Header */}
                <div className="p-4 pb-3 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-text text-sm leading-snug truncate">{kpi.title}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{kpi.evaluationPeriod}</p>
                    </div>
                    <Badge className={`${getStatusColor(kpi.status)} text-xs flex items-center gap-1 shrink-0`}>
                      {getStatusIcon(kpi.status)}
                      {getStatusText(kpi.status)}
                    </Badge>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 pt-3 flex-1 space-y-3">
                  {kpi.description && (
                    <p className="text-xs text-gray-600 line-clamp-2">{kpi.description}</p>
                  )}

                  {hasValues ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Progress</span>
                        <span className="font-medium text-text">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Target: <span className="font-medium text-gray-600">{kpi.targetValue}</span></span>
                        <span>Actual: <span className="font-medium text-gray-600">{kpi.actualValue}</span></span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No values set for progress tracking</p>
                  )}

                  {kpi.notes && (
                    <p className="text-xs text-gray-500 line-clamp-2">
                      <span className="font-medium">Note: </span>{kpi.notes}
                    </p>
                  )}
                </div>

                {/* Card Footer */}
                <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {format(new Date(kpi.createdAt), 'MMM d, yyyy')}
                  </span>
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700"
                      onClick={() => handleEditKpi(kpi)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
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
              </Card>
            );
          })}
        </div>
      )}

      {/* KPI Form Dialog */}
      <Dialog open={showKpiForm} onOpenChange={setShowKpiForm}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingKpi ? "Edit KPI" : "Create New KPI"}</DialogTitle>
          </DialogHeader>
          <KpiForm employeeId={employeeId} kpi={editingKpi} onClose={closeKpiForm} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
