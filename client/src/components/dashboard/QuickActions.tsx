import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle, UserPlus, Receipt, CheckSquare } from "lucide-react";
import { Link } from "wouter";

export function QuickActions() {
  const { t } = useTranslation();

  // Fetch real-time stats for quick overview
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const { data: taskStats } = useQuery({
    queryKey: ["/api/tasks/stats"],
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["/api/invoices"],
  });

  const { data: healthData, isLoading: healthLoading } = useQuery<{ status: string; db: boolean }>({
    queryKey: ["/api/health"],
    refetchInterval: 60000,
  });

  const taskData = taskStats as any;
  const clientsData = clients as any[];
  const invoicesData = invoices as any[];
  
  const pendingTasks = taskData?.statusBreakdown?.pending || 0;
  const activeClients = clientsData.filter((client: any) => client.status === 'active').length;
  const overdueInvoices = invoicesData.filter((inv: any) => 
    inv.status === 'overdue' || (new Date(inv.dueDate) < new Date() && inv.status !== 'paid')
  ).length;

  const actions = [
    {
      icon: PlusCircle,
      label: "Create Quotation",
      href: "/quotations",
      badge: null,
    },
    {
      icon: UserPlus,
      label: "Add New Client",
      href: "/clients",
      badge: activeClients > 0 ? `${activeClients} active` : null,
    },
    {
      icon: Receipt,
      label: "Log Expense",
      href: "/expenses",
      badge: null,
    },
    {
      icon: CheckSquare,
      label: "Assign Task",
      href: "/tasks",
      badge: pendingTasks > 0 ? `${pendingTasks} pending` : null,
    },
  ];

  return (
    <Card>
      <CardHeader className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
      </CardHeader>
      <CardContent className="p-2">
        <ul>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <li key={action.label}>
                <Link href={action.href}>
                  <div className="flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-sm text-foreground hover:bg-accent">
                    <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                    <span className="flex-1">{action.label}</span>
                    {action.badge && <span className="text-xs text-muted-foreground tabular-nums">{action.badge}</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mx-3 mt-2 space-y-2 border-t border-border py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">System Status</span>
            {healthLoading ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/40" />
                Checking...
              </span>
            ) : healthData?.db ? (
              <span className="flex items-center gap-1.5 text-success">
                <span className="h-2 w-2 rounded-full bg-success" />
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-danger">
                <span className="h-2 w-2 rounded-full bg-danger" />
                Degraded
              </span>
            )}
          </div>
          {overdueInvoices > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Overdue Invoices</span>
              <span className="font-medium text-danger tabular-nums">{overdueInvoices}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
