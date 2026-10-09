import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/lib/i18n";
import { formatDistanceToNow } from "@/lib/dateUtils";
import { Check, UserPlus, FileText, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Activity } from "@shared/schema";

const activityIcons = {
  invoice_paid: { icon: Check, bg: "bg-success-soft", color: "text-success" },
  client_added: { icon: UserPlus, bg: "bg-muted", color: "text-muted-foreground" },
  quotation_sent: { icon: FileText, bg: "bg-muted", color: "text-muted-foreground" },
  expense_approval: { icon: AlertCircle, bg: "bg-danger-soft", color: "text-danger" },
};

export function RecentActivities() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["/api/activities"],
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const activityList = Array.isArray(activities) ? activities as Activity[] : [];

  if (isLoading) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader className="border-b border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-16" />
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-start space-x-4">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Recent Activities</h3>
          <Button variant="link" size="sm" className="h-auto p-0">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <div>
          {activityList.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-muted-foreground/70" />
              </div>
              <p className="text-neutral text-sm">No recent activities</p>
              <p className="text-neutral text-xs mt-1">Activities will appear here as users interact with the system</p>
            </div>
          ) : (
            activityList.slice(0, 5).map((activity) => {
              const activityType = activityIcons[activity.type as keyof typeof activityIcons] || activityIcons.client_added;
              const Icon = activityType.icon;
              
              return (
                <div key={activity.id} className="flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/60">
                  <div className={`h-7 w-7 ${activityType.bg} rounded-full flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`${activityType.color} h-3.5 w-3.5`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{activity.title}</p>
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDistanceToNow(activity.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
