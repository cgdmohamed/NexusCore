import { Header } from "@/components/dashboard/Header";
import { KPICards } from "@/components/dashboard/KPICards";
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
    <div className="space-y-6">
      <Header 
        title={t('dashboard.title')}
        subtitle={t('dashboard.welcome', { name: userName })}
      />
      
      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <KPICards />
        
        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RecentActivities />
          
          <div className="space-y-6">
            <QuickActions />
            <TeamPerformance />
          </div>
        </div>
        
        {/* Data Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ClientsTable />
          <TasksTable />
        </div>
      </div>
    </div>
  );
}
