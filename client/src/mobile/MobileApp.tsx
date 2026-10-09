import { useState } from "react";
import { useLocation, Link } from "wouter";
import { LayoutDashboard, CheckSquare, FolderKanban, Users, MessageSquare, Bell, Plus, Languages, LogOut, Monitor, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useNotifications } from "@/hooks/useNotifications";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OfflineBanner } from "./ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { userAvatarSrc, userInitials } from "@/lib/user-avatar";
import { useInstall, useOnline } from "./hooks";
import { QuickAdd, type AddRequest } from "./QuickAdd";
import OverviewScreen from "./OverviewScreen";
import TasksScreen from "./TasksScreen";
import ProjectsScreen from "./ProjectsScreen";
import ClientsScreen from "./ClientsScreen";
import AlertsScreen from "./AlertsScreen";
import { MessagesScreen } from "./MessagesScreen";
import { PushSettings } from "@/components/notifications/PushSettings";
import { Segmented } from "./ui";
import { useQuery } from "@tanstack/react-query";

type Tab = "overview" | "tasks" | "projects" | "clients" | "inbox";

// Adding a screen later means one entry here plus its component
const TABS: { key: Tab; icon: typeof CheckSquare; label: string; module: string | null }[] = [
  { key: "overview", icon: LayoutDashboard, label: "m.tab_overview", module: null },
  { key: "tasks", icon: CheckSquare, label: "m.tab_tasks", module: "tasks" },
  { key: "projects", icon: FolderKanban, label: "m.tab_projects", module: "projects" },
  { key: "clients", icon: Users, label: "m.tab_clients", module: "crm" },
  { key: "inbox", icon: MessageSquare, label: "m.tab_inbox", module: null },
];

export default function MobileApp() {
  const { t, language, changeLanguage } = useTranslation();
  const { user, logoutMutation } = useAuth();
  const { canView, canAdd } = usePermissions();
  const { unreadCount } = useNotifications(1, 1);
  const messagesUnread = useQuery<{ unreadCount: number }>({ queryKey: ["/api/messages/unread-count"], refetchInterval: 15_000, staleTime: 10_000, refetchOnWindowFocus: true }).data?.unreadCount ?? 0;
  const online = useOnline();
  const install = useInstall();
  const [location, navigate] = useLocation();
  const [addOpen, setAddOpen] = useState(false);
  const [request, setRequest] = useState<AddRequest>({});

  const tabs = TABS.filter((tab) => tab.module === null || canView(tab.module));
  const parts = location.split("/");
  const segment = parts[2];
  // Messages and alerts share the Inbox tab
  const area: string | undefined = segment === "messages" || segment === "alerts" ? "inbox" : segment || "overview";
  const active: Tab = tabs.find((x) => x.key === area)?.key ?? tabs[0]?.key ?? "inbox";
  const inThread = segment === "messages" && !!parts[3];
  const canAddAny = canAdd("tasks") || canAdd("projects") || canAdd("crm");

  const openAdd = (r: AddRequest = {}) => {
    setRequest(r);
    setAddOpen(true);
  };

  const slot = "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium";

  const tabButton = (tab: (typeof TABS)[number]) => (
    <Link key={tab.key} href={tab.key === "inbox" ? "/m/messages" : tab.key === "overview" ? "/m" : `/m/${tab.key}`} aria-current={active === tab.key ? "page" : undefined} className={cn(slot, active === tab.key ? "text-primary" : "text-muted-foreground")}>
      <span className="relative">
        <tab.icon className="h-5 w-5" strokeWidth={active === tab.key ? 2.25 : 1.75} />
        {tab.key === "inbox" && unreadCount + messagesUnread > 0 && (
          <span className="absolute -end-2 -top-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 text-white tabular-nums">{unreadCount + messagesUnread > 9 ? "9+" : unreadCount + messagesUnread}</span>
        )}
      </span>
      {t(tab.label)}
    </Link>
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <h1 className="text-lg font-semibold">{t(TABS.find((x) => x.key === active)!.label)}</h1>
        <div className="flex items-center gap-1">
          <Link
            href="/m/alerts"
            aria-label={`${t("m.tab_alerts")}${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
            aria-current={segment === "alerts" ? "page" : undefined}
            className={cn("relative flex h-11 w-11 items-center justify-center rounded-full", segment === "alerts" ? "bg-accent text-primary" : "text-muted-foreground")}
          >
            <Bell className="h-5 w-5" strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span className="absolute end-1 top-1 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 text-white tabular-nums">{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label={t("m.menu")} className="flex h-11 w-11 items-center justify-center rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={userAvatarSrc(user as any)} alt="" />
                  <AvatarFallback className="bg-primary text-sm font-medium text-primary-foreground">{userInitials(user as any)}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="truncate">{user?.email ?? user?.username}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="h-11" onClick={() => changeLanguage(language === "ar" ? "en" : "ar")}>
              <Languages className="me-2 h-4 w-4" />
              {language === "ar" ? "English" : "العربية"}
            </DropdownMenuItem>
            {install.canPrompt && (
              <DropdownMenuItem className="h-11" onClick={() => install.install()}>
                <Download className="me-2 h-4 w-4" />
                {t("m.install")}
              </DropdownMenuItem>
            )}
            {install.showIosHint && <p className="px-2 py-1.5 text-xs text-muted-foreground">{t("m.install_ios")}</p>}
            <DropdownMenuItem className="h-11" onClick={() => navigate("/")}>
              <Monitor className="me-2 h-4 w-4" />
              {t("m.desktop")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="h-11 text-danger focus:text-danger" onClick={() => logoutMutation.mutate()}>
              <LogOut className="me-2 h-4 w-4" />
              {t("m.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {!online && <OfflineBanner />}

      <main className={cn("flex-1 overscroll-contain", inThread ? "overflow-hidden" : "overflow-y-auto")}>
        {active === "overview" && <OverviewScreen />}
        {active === "tasks" && <TasksScreen />}
        {active === "projects" && <ProjectsScreen onAdd={openAdd} />}
        {active === "clients" && <ClientsScreen onAdd={openAdd} />}
        {active === "inbox" && (
          <div className={inThread ? "h-full" : undefined}>
            {!inThread && (
              <div className="space-y-3 px-4 pt-4">
                <PushSettings platform="mobile" variant="banner" />
                <Segmented
                  value={segment === "alerts" ? "alerts" : "messages"}
                  onChange={(v) => navigate(`/m/${v}`)}
                  options={[
                    { value: "messages", label: `${t("m.messages")}${messagesUnread > 0 ? ` (${messagesUnread})` : ""}` },
                    { value: "alerts", label: `${t("m.tab_alerts")}${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
                  ]}
                />
              </div>
            )}
            {segment === "alerts" ? <AlertsScreen /> : <MessagesScreen conversationId={parts[3]} />}
          </div>
        )}
      </main>

      {canAddAny && !inThread && (
        <button onClick={() => openAdd()} aria-label={t("m.add")} className="fixed end-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95">
          <Plus className="h-6 w-6" />
        </button>
      )}

      <nav className="flex items-center border-t border-border bg-card pb-[env(safe-area-inset-bottom)]" aria-label="Main">
        {tabs.map(tabButton)}
      </nav>

      <QuickAdd open={addOpen} onOpenChange={setAddOpen} request={request} />
    </div>
  );
}
