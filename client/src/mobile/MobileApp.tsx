import { useState } from "react";
import { useLocation, Link } from "wouter";
import { CheckSquare, FolderKanban, Users, Bell, Plus, Languages, LogOut, Monitor, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useNotifications } from "@/hooks/useNotifications";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OfflineBanner } from "./ui";
import { useInstall, useOnline } from "./hooks";
import { QuickAdd, type AddRequest } from "./QuickAdd";
import TasksScreen from "./TasksScreen";
import ProjectsScreen from "./ProjectsScreen";
import ClientsScreen from "./ClientsScreen";
import AlertsScreen from "./AlertsScreen";

type Tab = "tasks" | "projects" | "clients" | "alerts";

// Adding a screen later means one entry here plus its component
const TABS: { key: Tab; icon: typeof CheckSquare; label: string; module: string | null }[] = [
  { key: "tasks", icon: CheckSquare, label: "m.tab_tasks", module: "tasks" },
  { key: "projects", icon: FolderKanban, label: "m.tab_projects", module: "projects" },
  { key: "clients", icon: Users, label: "m.tab_clients", module: "crm" },
  { key: "alerts", icon: Bell, label: "m.tab_alerts", module: null },
];

export default function MobileApp() {
  const { t, language, changeLanguage } = useTranslation();
  const { user, logoutMutation } = useAuth();
  const { canView, canAdd } = usePermissions();
  const { unreadCount } = useNotifications(1, 1);
  const online = useOnline();
  const install = useInstall();
  const [location, navigate] = useLocation();
  const [addOpen, setAddOpen] = useState(false);
  const [request, setRequest] = useState<AddRequest>({});

  const tabs = TABS.filter((tab) => tab.module === null || canView(tab.module));
  const segment = location.split("/")[2] as Tab | undefined;
  const active: Tab = tabs.find((x) => x.key === segment)?.key ?? tabs[0]?.key ?? "alerts";
  const canAddAny = canAdd("tasks") || canAdd("projects") || canAdd("crm");

  const openAdd = (r: AddRequest = {}) => {
    setRequest(r);
    setAddOpen(true);
  };

  const initials = (user?.firstName && user?.lastName ? `${user.firstName[0]}${user.lastName[0]}` : (user?.username ?? "U").slice(0, 2)).toUpperCase();
  const half = Math.ceil(tabs.length / 2);
  const slot = "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium";

  const tabButton = (tab: (typeof TABS)[number]) => (
    <Link key={tab.key} href={`/m/${tab.key}`} aria-current={active === tab.key ? "page" : undefined} className={cn(slot, active === tab.key ? "text-primary" : "text-muted-foreground")}>
      <span className="relative">
        <tab.icon className="h-5 w-5" strokeWidth={active === tab.key ? 2.25 : 1.75} />
        {tab.key === "alerts" && unreadCount > 0 && (
          <span className="absolute -end-2 -top-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 text-white tabular-nums">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </span>
      {t(tab.label)}
    </Link>
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <h1 className="text-lg font-semibold">{t(TABS.find((x) => x.key === active)!.label)}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label={t("m.menu")} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">{initials}</button>
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
      </header>

      {!online && <OfflineBanner />}

      <main className="flex-1 overflow-y-auto overscroll-contain">
        {active === "tasks" && <TasksScreen />}
        {active === "projects" && <ProjectsScreen onAdd={openAdd} />}
        {active === "clients" && <ClientsScreen onAdd={openAdd} />}
        {active === "alerts" && <AlertsScreen />}
      </main>

      <nav className="flex items-center border-t border-border bg-card pb-[env(safe-area-inset-bottom)]" aria-label="Main">
        {tabs.slice(0, half).map(tabButton)}
        {canAddAny && (
          <div className="flex flex-1 justify-center">
            <button onClick={() => openAdd()} aria-label={t("m.add")} className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95">
              <Plus className="h-6 w-6" />
            </button>
          </div>
        )}
        {tabs.slice(half).map(tabButton)}
      </nav>

      <QuickAdd open={addOpen} onOpenChange={setAddOpen} request={request} />
    </div>
  );
}
