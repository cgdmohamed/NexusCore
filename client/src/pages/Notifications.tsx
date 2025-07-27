import { useState } from "react";
import { Bell, Check, CheckCheck, Clock, Filter, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "@/lib/i18n";

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "task_assigned":
    case "task_updated":
    case "task_completed":
    case "task_overdue":
      return <Bell className="w-4 h-4 text-blue-500" />;
    case "expense_submitted":
    case "expense_approved":
    case "expense_rejected":
    case "expense_paid":
      return <Bell className="w-4 h-4 text-green-500" />;
    case "invoice_created":
    case "invoice_updated":
    case "invoice_paid":
    case "invoice_overdue":
      return <Bell className="w-4 h-4 text-purple-500" />;
    case "quotation_created":
    case "quotation_sent":
    case "quotation_accepted":
    case "quotation_rejected":
    case "quotation_expired":
      return <Bell className="w-4 h-4 text-orange-500" />;
    case "client_added":
    case "client_updated":
    case "client_status_changed":
      return <Bell className="w-4 h-4 text-cyan-500" />;
    case "payment_received":
    case "payment_failed":
    case "payment_refunded":
      return <Bell className="w-4 h-4 text-emerald-500" />;
    default:
      return <Bell className="w-4 h-4 text-gray-500" />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "urgent":
      return "bg-red-500";
    case "high":
      return "bg-orange-500";
    case "medium":
      return "bg-blue-500";
    case "low":
      return "bg-gray-500";
    default:
      return "bg-gray-500";
  }
};

export default function Notifications() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markMultipleAsRead,
    isMarkingAsRead,
    isMarkingMultipleAsRead,
  } = useNotifications(currentPage, 20, filterType === "unread");

  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.message.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterType === "all") return matchesSearch;
    if (filterType === "unread") return matchesSearch && !notification.isRead;
    if (filterType === "read") return matchesSearch && notification.isRead;
    
    return matchesSearch && notification.type === filterType;
  });

  const handleMarkAllAsRead = () => {
    const unreadNotifications = notifications.filter(n => !n.isRead);
    if (unreadNotifications.length > 0) {
      markMultipleAsRead(unreadNotifications.map(n => n.id));
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t("notifications.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("notifications.subtitle")}
          </p>
        </div>
        
        {unreadCount > 0 && (
          <Button
            onClick={handleMarkAllAsRead}
            disabled={isMarkingMultipleAsRead}
            className="flex items-center gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            {t("notifications.markAllRead")} ({unreadCount})
          </Button>
        )}
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t("notifications.filters")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder={t("notifications.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("notifications.filters.all")}</SelectItem>
                <SelectItem value="unread">{t("notifications.filters.unread")}</SelectItem>
                <SelectItem value="read">{t("notifications.filters.read")}</SelectItem>
                <SelectItem value="invoice.paid">{t("notifications.types.invoice")}</SelectItem>
                <SelectItem value="client.added">{t("notifications.types.client")}</SelectItem>
                <SelectItem value="task.assigned">{t("notifications.types.task")}</SelectItem>
                <SelectItem value="expense.submitted">{t("notifications.types.expense")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t("notifications.allNotifications")}</span>
            <Badge variant="secondary">
              {filteredNotifications.length} {t("notifications.total")}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[600px]">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-start space-x-4 p-4 border rounded-lg">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {t("notifications.empty")}
                </h3>
                <p className="text-muted-foreground">
                  {searchTerm || filterType !== "all" 
                    ? t("notifications.noResults") 
                    : t("notifications.noNotifications")
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`flex items-start space-x-4 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      !notification.isRead 
                        ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" 
                        : "bg-white dark:bg-gray-900"
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {notification.title}
                        </h4>
                        <div className="flex items-center space-x-2 ml-4">
                          {notification.priority && notification.priority !== "medium" && (
                            <div className={`w-2 h-2 rounded-full ${getPriorityColor(notification.priority)}`} />
                          )}
                          {!notification.isRead && (
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-gray-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>
                        
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            disabled={isMarkingAsRead}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            {t("notifications.markRead")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}