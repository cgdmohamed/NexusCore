import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/lib/i18n";
import { LanguageToggle } from "@/components/ui/language-toggle";
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
  Building,
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
        {/* Logo */}
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Building className="text-white text-sm" />
          </div>
          <h1 className="text-xl font-semibold text-text">CompanyOS</h1>
        </div>
        
        {/* User Profile Section */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-3">
            <img 
              src={currentUser?.profileImageUrl || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100"} 
              alt="Profile Picture" 
              className="w-10 h-10 rounded-full object-cover" 
            />
            <div>
              <p className="font-medium text-text text-sm">
                {currentUser?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-xs text-neutral">
                {currentUser?.email || 'staff@company.com'}
              </p>
            </div>
          </div>
        </div>

        {/* Language Toggle */}
        <div className="mb-6">
          <LanguageToggle />
        </div>

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