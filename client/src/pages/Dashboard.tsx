import { Header } from "@/components/dashboard/Header";
import { KPICards } from "@/components/dashboard/KPICards";
import { AttentionStrip } from "@/components/dashboard/AttentionStrip";
import { ReceivablesAging } from "@/components/dashboard/ReceivablesAging";
import { RevenueVsExpenses } from "@/components/dashboard/RevenueVsExpenses";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { TeamPerformance } from "@/components/dashboard/TeamPerformance";
import { ClientsTable } from "@/components/dashboard/ClientsTable";
import { TasksTable } from "@/components/dashboard/TasksTable";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/lib/i18n";
import type { User } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const currentUser = user as User | undefined;
  const userName = currentUser?.email ? currentUser.email.split('@')[0] : 'User';
  
  return (
    <div>
      <Header 
        title={t('dashboard.title')}
        subtitle={t('dashboard.welcome', { name: userName })}
      />
      
      <div className="p-3 md:p-6 space-y-4">
        {/* KPI Cards */}
        <KPICards />

        {/* What needs attention, then the money picture */}
        <AttentionStrip />
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <RevenueVsExpenses />
          <ReceivablesAging />
        </div>
        
        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <RecentActivities />
          
          <div className="space-y-4">
            <QuickActions />
            <TeamPerformance />
          </div>
        </div>
        
        {/* Data Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <ClientsTable />
          <TasksTable />
        </div>
      </div>
    </div>
  );
}
