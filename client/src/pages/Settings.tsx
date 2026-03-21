import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/dashboard/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  Database,
  Mail,
  CheckCircle2,
  XCircle,
  Building2,
  Server,
  Clock,
  HardDrive,
  Users,
  FileText,
  CheckSquare,
  Bell,
  Loader2,
  Phone,
  MapPin,
  Hash,
} from "lucide-react";

interface SystemInfo {
  stats: {
    users: number;
    employees: number;
    clients: number;
    invoices: number;
    tasks: number;
    notifications: number;
  };
  system: {
    nodeVersion: string;
    uptime: number;
    memoryUsedMb: number;
    memoryTotalMb: number;
    environment: string;
  };
  smtp: {
    configured: boolean;
    host: string | null;
    from: string | null;
  };
  company: {
    name: string;
    email: string;
    phone: string;
    address: string;
    vatNumber: string;
    regNumber: string;
  };
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function Settings() {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const { data: infoData, isLoading } = useQuery<{ success: boolean; data: SystemInfo }>({
    queryKey: ["/api/settings/system-info"],
    refetchInterval: 30000,
  });
  const info = infoData?.data;

  const handleBackup = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/settings/backup", { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Backup failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded", description: "All database records exported successfully." });
    } catch (err: any) {
      toast({ title: "Backup failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const statCards = info
    ? [
        { label: "Users", value: info.stats.users, icon: Users, color: "text-blue-500" },
        { label: "Employees", value: info.stats.employees, icon: Users, color: "text-indigo-500" },
        { label: "Clients", value: info.stats.clients, icon: Building2, color: "text-violet-500" },
        { label: "Invoices", value: info.stats.invoices, icon: FileText, color: "text-emerald-500" },
        { label: "Tasks", value: info.stats.tasks, icon: CheckSquare, color: "text-amber-500" },
        { label: "Notifications", value: info.stats.notifications, icon: Bell, color: "text-rose-500" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <Header title="Settings" subtitle="System configuration and administration tools" />

      <div className="p-3 md:p-6 space-y-6">

        {/* ─── Company Profile ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Profile
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Company details used across invoices, quotations, and emails. Set via environment variables.
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "Company Name", value: info?.company.name, icon: Building2 },
                  { label: "Email", value: info?.company.email || "Not set", icon: Mail },
                  { label: "Phone", value: info?.company.phone || "Not set", icon: Phone },
                  { label: "Address", value: info?.company.address || "Not set", icon: MapPin },
                  { label: "VAT Number", value: info?.company.vatNumber || "Not set", icon: Hash },
                  { label: "Reg. Number", value: info?.company.regNumber || "Not set", icon: Hash },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg">
                    <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                      <p className="text-sm font-medium truncate">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              To update these values, edit the <code className="bg-muted px-1 py-0.5 rounded text-xs">COMPANY_*</code> environment variables in your deployment configuration.
            </p>
          </CardContent>
        </Card>

        {/* ─── Database Backup ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Backup
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Download a complete snapshot of all application data as a JSON file. Passwords and session tokens are excluded.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border border-dashed rounded-lg bg-muted/30">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Full Data Export</p>
                <p className="text-xs text-muted-foreground">
                  Exports all records from every table — clients, invoices, employees, tasks, messages, and more — into a single structured JSON file. Excludes sensitive auth data.
                </p>
              </div>
              <Button
                onClick={handleBackup}
                disabled={downloading}
                className="shrink-0 w-full sm:w-auto"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {downloading ? "Preparing..." : "Download Backup"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The backup file is named <code className="bg-muted px-1 py-0.5 rounded">backup-YYYY-MM-DD.json</code> and can be used to restore or migrate data. For SQL-level backups, use your database provider's tools.
            </p>
          </CardContent>
        </Card>

        {/* ─── Email / SMTP Status ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Configuration
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Current SMTP status used for sending notifications and invoices.
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-8 w-48" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg border">
                  {info?.smtp.configured ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {info?.smtp.configured ? "SMTP Connected" : "SMTP Not Configured"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {info?.smtp.configured
                        ? `Sending via ${info.smtp.host} · From: ${info.smtp.from}`
                        : "Set SMTP_USER and SMTP_PASS environment variables to enable email delivery."}
                    </p>
                  </div>
                  <Badge
                    variant={info?.smtp.configured ? "default" : "secondary"}
                    className="ml-auto shrink-0"
                  >
                    {info?.smtp.configured ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure email via <code className="bg-muted px-1 py-0.5 rounded">SMTP_HOST</code>, <code className="bg-muted px-1 py-0.5 rounded">SMTP_USER</code>, <code className="bg-muted px-1 py-0.5 rounded">SMTP_PASS</code>, and <code className="bg-muted px-1 py-0.5 rounded">SMTP_FROM</code> environment variables.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── System Information ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              System Information
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Live server stats and record counts. Auto-refreshes every 30 seconds.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Record counts */}
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {statCards.map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="flex flex-col items-center justify-center p-3 bg-muted/40 rounded-lg text-center gap-1">
                    <Icon className={`h-5 w-5 ${color}`} />
                    <p className="text-2xl font-bold leading-none">{value.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Server metrics */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "Environment", value: info?.system.environment ?? "—", icon: Server },
                  { label: "Node.js Version", value: info?.system.nodeVersion ?? "—", icon: Server },
                  { label: "Server Uptime", value: info ? formatUptime(info.system.uptime) : "—", icon: Clock },
                  { label: "Memory Usage", value: info ? `${info.system.memoryUsedMb} MB / ${info.system.memoryTotalMb} MB` : "—", icon: HardDrive },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
