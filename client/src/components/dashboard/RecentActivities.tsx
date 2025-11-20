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
  invoice_paid: { icon: Check, bg: "bg-green-100", color: "text-secondary" },
  client_added: { icon: UserPlus, bg: "bg-blue-100", color: "text-primary" },
  quotation_sent: { icon: FileText, bg: "bg-yellow-100", color: "text-yellow-600" },
  expense_approval: { icon: AlertCircle, bg: "bg-red-100", color: "text-accent" },
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
        <CardHeader className="border-b border-gray-200">
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
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text">Recent Activities</h3>
          <Button variant="link" size="sm">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {activityList.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-neutral text-sm">No recent activities</p>
              <p className="text-neutral text-xs mt-1">Activities will appear here as users interact with the system</p>
            </div>
          ) : (
            activityList.slice(0, 5).map((activity) => {
              const activityType = activityIcons[activity.type as keyof typeof activityIcons] || activityIcons.client_added;
              const Icon = activityType.icon;
              
              return (
                <div key={activity.id} className="flex items-start space-x-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className={`w-8 h-8 ${activityType.bg} rounded-full flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`${activityType.color} text-sm w-4 h-4`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-text font-medium">{activity.title}</p>
                    <p className="text-neutral text-sm">{activity.description}</p>
                    <p className="text-neutral text-xs mt-1">
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
