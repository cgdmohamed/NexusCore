import { Link, useLocation } from "wouter";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useTranslation } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import {
  LayoutDashboard,
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
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  type LucideIcon,
} from "lucide-react";

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

type Tone = "neutral" | "alert";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  module: string;
  adminOnly?: boolean;
  badge?: string;
  badgeTone?: Tone;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { canView, isAdmin } = usePermissions();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  const currentUser = user as User | undefined;
  void currentUser;

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
  const overdueCount = invoices.filter((inv: any) => inv.status === "overdue").length;
  const pendingTasks = taskStats?.statusBreakdown?.pending || 0;

  // Badges only appear where something needs attention (overdue invoices, open tasks, unread messages)
  const groups: NavGroup[] = [
    {
      items: [{ name: "nav.dashboard", href: "/", icon: LayoutDashboard, module: "dashboard" }],
    },
    {
      label: "nav.group.sales",
      items: [
        { name: "nav.clients", href: "/clients", icon: Users, module: "crm" },
        { name: "nav.quotations", href: "/quotations", icon: FileText, module: "quotations" },
        {
          name: "nav.invoices",
          href: "/invoices",
          icon: Receipt,
          module: "invoices",
          badge: overdueCount > 0 ? String(overdueCount) : undefined,
          badgeTone: "alert",
        },
      ],
    },
    {
      label: "nav.group.finance",
      items: [
        { name: "nav.payments", href: "/payment-sources", icon: Wallet, module: "paymentSources" },
        { name: "nav.expenses", href: "/expenses", icon: CreditCard, module: "expenses" },
      ],
    },
    {
      label: "nav.group.work",
      items: [
        {
          name: "nav.tasks",
          href: "/tasks",
          icon: CheckSquare,
          module: "tasks",
          badge: pendingTasks > 0 ? String(pendingTasks) : undefined,
        },
        { name: "nav.projects", href: "/projects", icon: FolderKanban, module: "projects" },
        {
          name: "nav.messages",
          href: "/messages",
          icon: MessageSquare,
          module: "dashboard",
          badge: unreadMsgCount > 0 ? String(unreadMsgCount) : undefined,
        },
      ],
    },
    {
      label: "nav.group.company",
      items: [
        { name: "nav.services", href: "/services", icon: Briefcase, module: "services" },
        { name: "nav.reports_kpis", href: "/reports-kpis", icon: TrendingUp, module: "analytics" },
        { name: "nav.team_roles", href: "/team-roles", icon: UserCog, module: "employees", adminOnly: true },
        { name: "nav.settings", href: "/settings", icon: Settings, module: "employees", adminOnly: true },
      ],
    },
  ];

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => (item.adminOnly ? isAdmin : true) && canView(item.module)),
    }))
    .filter((group) => group.items.length > 0);

  const isActive = (href: string) => (href === "/" ? location === "/" : location === href || location.startsWith(href + "/"));

  const navContent = (isMobileDrawer = false) => {
    const isCollapsed = !isMobileDrawer && collapsed;

    return (
      <>
        {isMobileDrawer && (
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <span className="text-sm font-semibold">{t("nav.menu")}</span>
            <button
              onClick={onMobileClose}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={t("nav.close_menu")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main">
          {visibleGroups.map((group, groupIndex) => (
            <div key={group.label ?? "top"} className={cn(groupIndex > 0 && "mt-5")}>
              {group.label && !isCollapsed && (
                <p className="mb-1 px-2.5 text-xs font-medium text-muted-foreground">{t(group.label)}</p>
              )}
              {group.label && isCollapsed && groupIndex > 0 && <div className="mx-2 mb-2 border-t border-border" />}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={() => onMobileClose?.()}
                        aria-current={active ? "page" : undefined}
                        title={isCollapsed ? t(item.name) : undefined}
                        className={cn(
                          "relative flex h-9 items-center gap-2.5 rounded-md text-sm transition-colors",
                          isCollapsed ? "justify-center px-0" : "px-2.5",
                          active
                            ? "bg-accent font-medium text-foreground"
                            : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} strokeWidth={1.75} />
                        {!isCollapsed && <span className="flex-1 truncate">{t(item.name)}</span>}
                        {item.badge &&
                          (isCollapsed ? (
                            <span
                              className={cn(
                                "absolute end-1.5 top-1.5 h-2 w-2 rounded-full",
                                item.badgeTone === "alert" ? "bg-destructive" : "bg-primary",
                              )}
                              aria-label={item.badge}
                            />
                          ) : (
                            <span
                              className={cn(
                                "min-w-5 rounded-full px-1.5 text-center text-[11px] font-medium leading-5 tabular-nums",
                                item.badgeTone === "alert"
                                  ? "bg-danger-soft text-danger"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {item.badge}
                            </span>
                          ))}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {!isMobileDrawer && (
          <div className="border-t border-border p-2">
            <button
              onClick={toggle}
              className={cn(
                "flex h-9 w-full items-center gap-2.5 rounded-md text-sm text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground",
                isCollapsed ? "justify-center px-0" : "px-2.5",
              )}
              title={collapsed ? t("nav.expand") : t("nav.collapse")}
              aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
            >
              {/* The icon flips with the reading direction so it always points the way the panel will move */}
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4 rtl:-scale-x-100" strokeWidth={1.75} />
              ) : (
                <PanelLeftClose className="h-4 w-4 rtl:-scale-x-100" strokeWidth={1.75} />
              )}
              {!isCollapsed && <span>{t("nav.collapse")}</span>}
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onMobileClose} aria-hidden="true" />
      )}

      {/* Mobile drawer: slides in from the reading-start edge in both directions */}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e border-border bg-card shadow-xl transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
        )}
        aria-hidden={!mobileOpen}
      >
        {navContent(true)}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-e border-border bg-card transition-[width] duration-200 md:flex",
          collapsed ? "w-14" : "w-60",
        )}
      >
        {navContent(false)}
      </aside>
    </>
  );
}
