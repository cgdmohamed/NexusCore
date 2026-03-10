import { Link, useLocation } from "wouter";
import { useState } from "react";
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
  FolderKanban,
  TrendingUp,
  UserCog,
  Briefcase,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { canView, isAdmin } = usePermissions();
  const { t, language } = useTranslation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  const currentUser = user as User | undefined;

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  };

  const { data: taskStats } = useQuery<any>({
    queryKey: ["/api/tasks/stats"],
    refetchInterval: 30000,
    enabled: canView("tasks"),
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    refetchInterval: 30000,
    enabled: canView("crm"),
  });

  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
    refetchInterval: 30000,
    enabled: canView("invoices"),
  });

  const { data: unreadMsgData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 15000,
    enabled: !!user,
  });
  const unreadMsgCount = unreadMsgData?.unreadCount || 0;

  const allNavigation = [
    { name: "nav.dashboard", href: "/", icon: BarChart3, module: "dashboard" },
    {
      name: "nav.clients",
      href: "/clients",
      icon: Users,
      module: "crm",
      badge: clients.length > 0 ? clients.length.toString() : undefined,
      badgeColor: "bg-blue-500",
    },
    { name: "nav.quotations", href: "/quotations", icon: FileText, module: "quotations" },
    {
      name: "nav.invoices",
      href: "/invoices",
      icon: Receipt,
      module: "invoices",
      badge:
        invoices.filter((inv: any) => inv.status === "overdue").length > 0
          ? invoices.filter((inv: any) => inv.status === "overdue").length.toString()
          : undefined,
      badgeColor: "bg-red-500",
    },
    { name: "nav.payments", href: "/payment-sources", icon: Wallet, module: "paymentSources" },
    { name: "nav.expenses", href: "/expenses", icon: CreditCard, module: "expenses" },
    {
      name: "nav.tasks",
      href: "/tasks",
      icon: CheckSquare,
      module: "tasks",
      badge: taskStats?.statusBreakdown?.pending
        ? taskStats.statusBreakdown.pending.toString()
        : undefined,
      badgeColor: "bg-yellow-500",
    },
    { name: "nav.projects", href: "/projects", icon: FolderKanban, module: "tasks" },
    {
      name: "nav.messages",
      href: "/messages",
      icon: MessageSquare,
      module: "dashboard",
      badge: unreadMsgCount > 0 ? unreadMsgCount.toString() : undefined,
      badgeColor: "bg-green-500",
    },
    { name: "nav.services", href: "/services", icon: Briefcase, module: "quotations" },
    { name: "nav.team_roles", href: "/team-roles", icon: UserCog, module: "employees", adminOnly: true },
    { name: "nav.reports_kpis", href: "/reports-kpis", icon: TrendingUp, module: "analytics" },
  ];

  const navigation = allNavigation.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    return canView(item.module);
  });

  const handleNavClick = () => {
    if (onMobileClose) onMobileClose();
  };

  const navContent = (isMobileDrawer = false) => (
    <>
      {/* Header row */}
      <div className={cn(
        "flex items-center border-b border-gray-100 h-14",
        isMobileDrawer
          ? "justify-between px-3"
          : collapsed ? "justify-center" : "justify-end px-3"
      )}>
        {isMobileDrawer && (
          <span className="text-sm font-semibold text-gray-700">Menu</span>
        )}
        {isMobileDrawer ? (
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={toggle}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navigation.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          const isCollapsed = !isMobileDrawer && collapsed;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={handleNavClick}
              className={cn(
                "flex items-center rounded-lg transition-colors relative group",
                isCollapsed ? "justify-center px-0 py-2.5" : "space-x-3 rtl:space-x-reverse px-3 py-2",
                isActive ? "bg-primary text-white" : "text-neutral hover:bg-gray-50"
              )}
              title={isCollapsed ? t(item.name) : undefined}
            >
              <div className="relative flex-shrink-0">
                <Icon className="w-5 h-5" />
                {isCollapsed && item.badge && (
                  <span className={cn("absolute -top-1 -end-1 w-4 h-4 text-[10px] flex items-center justify-center rounded-full text-white", item.badgeColor || "bg-secondary")}>
                    {parseInt(item.badge) > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>

              {!isCollapsed && (
                <>
                  <span className="flex-1 truncate">{t(item.name)}</span>
                  {item.badge && (
                    <span className={cn("ms-auto text-xs px-2 py-0.5 rounded-full text-white", item.badgeColor || "bg-secondary")}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-white shadow-xl border-r border-gray-200 transition-transform duration-300 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent(true)}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col flex-shrink-0 bg-white shadow-lg border-r border-gray-200 transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {navContent(false)}
      </aside>
    </>
  );
}
