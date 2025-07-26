import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
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
} from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { t, language } = useTranslation();
  
  const currentUser = user as User | undefined;

  // Fetch real-time data for badges
  const { data: taskStats } = useQuery({
    queryKey: ["/api/tasks/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    refetchInterval: 30000,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["/api/invoices"],
    refetchInterval: 30000,
  });

  // Calculate navigation items with real-time badges
  const navigation = [
    { name: 'nav.dashboard', href: '/', icon: BarChart3 },
    { 
      name: 'nav.crm', 
      href: '/crm', 
      icon: Users, 
      badge: clients.length > 0 ? clients.length.toString() : undefined,
      badgeColor: 'bg-blue-500'
    },
    { name: 'nav.quotations', href: '/quotations', icon: FileText },
    { 
      name: 'nav.invoices', 
      href: '/invoices', 
      icon: Receipt,
      badge: invoices.filter((inv: any) => inv.status === 'overdue').length > 0 
        ? invoices.filter((inv: any) => inv.status === 'overdue').length.toString() 
        : undefined,
      badgeColor: 'bg-red-500'
    },
    { name: 'nav.expenses', href: '/expenses', icon: CreditCard },
    { name: 'nav.payment_sources', href: '/payment-sources', icon: Wallet },
    { name: 'nav.user_management', href: '/user-management', icon: UserCog },
    { 
      name: 'nav.tasks', 
      href: '/tasks', 
      icon: CheckSquare,
      badge: taskStats?.statusBreakdown?.pending 
        ? taskStats.statusBreakdown.pending.toString() 
        : undefined,
      badgeColor: 'bg-yellow-500'
    },
    { name: 'nav.analytics', href: '/analytics', icon: TrendingUp },
  ];

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