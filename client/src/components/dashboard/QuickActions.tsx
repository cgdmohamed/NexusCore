import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle, UserPlus, Receipt, CheckSquare, TrendingUp, DollarSign } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

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

  const pendingTasks = taskStats?.statusBreakdown?.pending || 0;
  const activeClients = clients.filter((client: any) => client.status === 'active').length;
  const overdueInvoices = invoices.filter((inv: any) => 
    inv.status === 'overdue' || (new Date(inv.dueDate) < new Date() && inv.status !== 'paid')
  ).length;

  const actions = [
    {
      icon: PlusCircle,
      label: "Create Quotation",
      href: "/quotations",
      color: "text-primary",
      badge: null,
    },
    {
      icon: UserPlus,
      label: "Add New Client",
      href: "/crm",
      color: "text-secondary",
      badge: activeClients > 0 ? `${activeClients} active` : null,
    },
    {
      icon: Receipt,
      label: "Log Expense",
      href: "/expenses",
      color: "text-purple-600",
      badge: null,
    },
    {
      icon: CheckSquare,
      label: "Assign Task",
      href: "/tasks",
      color: "text-yellow-600",
      badge: pendingTasks > 0 ? `${pendingTasks} pending` : null,
    },
  ];

  return (
    <Card>
      <CardHeader className="border-b border-gray-200">
        <h3 className="text-lg font-semibold text-text">Quick Actions</h3>
        <p className="text-sm text-neutral">System overview and shortcuts</p>
      </CardHeader>
      <CardContent className="space-y-3 pt-6">
        {actions.map((action, index) => {
          const Icon = action.icon;
          
          return (
            <Link key={index} href={action.href}>
              <Button
                variant="outline"
                className="w-full justify-between gap-3 h-auto p-3 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <Icon className={`${action.color} w-5 h-5`} />
                  <span className="text-text">{action.label}</span>
                </div>
                {action.badge && (
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                    {action.badge}
                  </span>
                )}
              </Button>
            </Link>
          );
        })}
        
        {/* System Status */}
        <div className="pt-3 mt-6 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral">System Status</span>
            <span className="text-green-600 flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Online
            </span>
          </div>
          {overdueInvoices > 0 && (
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-neutral">Overdue Invoices</span>
              <span className="text-red-600">{overdueInvoices}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
