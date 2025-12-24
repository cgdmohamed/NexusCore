import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useTranslation } from "@/lib/i18n";

import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import {
  BarChart3,
  Users,
  FileText,
  Receipt,
  CreditCard,
  Wallet,
  CheckSquare,
  TrendingUp,
  UserCog,
  Briefcase,
} from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { canView, isAdmin } = usePermissions();
  const { t, language } = useTranslation();
  
  const currentUser = user as User | undefined;

  // Fetch real-time data for badges
  const { data: taskStats } = useQuery<any>({
    queryKey: ["/api/tasks/stats"],
    refetchInterval: 30000,
    enabled: canView('tasks'),
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    refetchInterval: 30000,
    enabled: canView('crm'),
  });

  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
    refetchInterval: 30000,
    enabled: canView('invoices'),
  });

  // Define navigation items with permission requirements
  const allNavigation = [
    { name: 'nav.dashboard', href: '/', icon: BarChart3, module: 'dashboard' },
    { 
      name: 'nav.clients', 
      href: '/clients', 
      icon: Users, 
      module: 'crm',
      badge: clients.length > 0 ? clients.length.toString() : undefined,
      badgeColor: 'bg-blue-500'
    },
    { name: 'nav.quotations', href: '/quotations', icon: FileText, module: 'quotations' },
    { 
      name: 'nav.invoices', 
      href: '/invoices', 
      icon: Receipt,
      module: 'invoices',
      badge: invoices.filter((inv: any) => inv.status === 'overdue').length > 0 
        ? invoices.filter((inv: any) => inv.status === 'overdue').length.toString() 
        : undefined,
      badgeColor: 'bg-red-500'
    },
    { name: 'nav.payments', href: '/payment-sources', icon: Wallet, module: 'paymentSources' },
    { name: 'nav.expenses', href: '/expenses', icon: CreditCard, module: 'expenses' },
    { 
      name: 'nav.tasks', 
      href: '/tasks', 
      icon: CheckSquare,
      module: 'tasks',
      badge: taskStats?.statusBreakdown?.pending 
        ? taskStats.statusBreakdown.pending.toString() 
        : undefined,
      badgeColor: 'bg-yellow-500'
    },
    { name: 'nav.services', href: '/services', icon: Briefcase, module: 'quotations' },
    { name: 'nav.team_roles', href: '/team-roles', icon: UserCog, module: 'employees', adminOnly: true },
    { name: 'nav.reports_kpis', href: '/reports-kpis', icon: TrendingUp, module: 'analytics' },
  ];

  // Filter navigation based on permissions
  const navigation = allNavigation.filter(item => {
    // Admin-only items require admin role
    if (item.adminOnly && !isAdmin) {
      return false;
    }
    // Check if user can view this module
    return canView(item.module);
  });

  return (
    <aside className="w-64 bg-white shadow-lg flex-shrink-0 border-r border-gray-200">
      <div className="p-5">
        {/* Navigation Menu */}
        <nav className="space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                  isActive
                    ? "bg-primary text-white"
                    : "text-neutral hover:bg-gray-50"
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{t(item.name)}</span>
                {item.badge && (
                  <span className={cn(
                    "ml-auto text-xs px-2 py-1 rounded-full text-white",
                    item.badgeColor || "bg-secondary"
                  )}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* System Status Indicator */}
        <div className="mt-8 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-600 font-medium">
            System Status: Active
          </p>
          <p className="text-xs text-blue-500">
            All modules operational
          </p>
        </div>
      </div>
    </aside>
  );
}
