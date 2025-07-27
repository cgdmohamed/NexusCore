import { useState } from "react";
import { Bell, Check, CheckCheck, Clock, AlertCircle, Users, TrendingUp, FileText, DollarSign, CheckSquare } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";
import { useTranslation } from "@/lib/i18n";

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "task_assigned":
    case "task_updated":
    case "task_completed":
    case "task_overdue":
      return <CheckSquare className="w-4 h-4 text-blue-500" />;
    case "expense_submitted":
    case "expense_approved":
    case "expense_rejected":
    case "expense_paid":
      return <DollarSign className="w-4 h-4 text-green-500" />;
    case "invoice_created":
    case "invoice_updated":
    case "invoice_paid":
    case "invoice_overdue":
      return <FileText className="w-4 h-4 text-purple-500" />;
    case "quotation_created":
    case "quotation_sent":
    case "quotation_accepted":
    case "quotation_rejected":
    case "quotation_expired":
      return <FileText className="w-4 h-4 text-orange-500" />;
    case "kpi_assigned":
    case "kpi_updated":
    case "kpi_reviewed":
      return <TrendingUp className="w-4 h-4 text-indigo-500" />;
    case "client_added":
    case "client_updated":
    case "client_status_changed":
      return <Users className="w-4 h-4 text-cyan-500" />;
    case "payment_received":
    case "payment_failed":
    case "payment_refunded":
      return <DollarSign className="w-4 h-4 text-emerald-500" />;
    case "user_added":
    case "user_updated":
    case "user_deactivated":
      return <Users className="w-4 h-4 text-gray-500" />;
    case "system_maintenance":
    case "system_backup":
    case "system_alert":
      return <AlertCircle className="w-4 h-4 text-red-500" />;
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

export function NotificationDropdown() {
  const { t } = useTranslation();
  const [location, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markMultipleAsRead,
    isMarkingAsRead,
    isMarkingMultipleAsRead,
  } = useNotifications(1, 10, false); // Get latest 10 notifications

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    // Navigate to entity if URL provided
    if (notification.entityUrl) {
      navigate(notification.entityUrl);
      setIsOpen(false);
    }
  };

  const handleMarkAllAsRead = () => {
    const unreadNotifications = (notifications || []).filter((n: any) => !n.isRead);
    if (unreadNotifications.length > 0) {
      markMultipleAsRead(unreadNotifications.map((n: any) => n.id));
    }
  };

  const handleViewAll = () => {
    navigate("/notifications");
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold min-w-[1.25rem]"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80 max-w-[90vw]">
        <div className="flex items-center justify-between p-2">
          <DropdownMenuLabel className="text-sm font-semibold">
            {t("notifications.title")}
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isMarkingMultipleAsRead}
              className="h-auto p-1 text-xs"
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
        
        <DropdownMenuSeparator />
        
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="p-2 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start space-x-2 p-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-2 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !notifications || !Array.isArray(notifications) || notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>{t("notifications.empty")}</p>
            </div>
          ) : (
            <div className="p-1">
              {(notifications || []).map((notification: any) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={`p-3 cursor-pointer space-y-1 focus:bg-gray-50 dark:focus:bg-gray-800 ${
                    !notification.isRead 
                      ? "bg-blue-50 dark:bg-blue-950/20 border-l-2 border-blue-500" 
                      : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {notification.title}
                        </p>
                        <div className="flex items-center space-x-1 ml-2">
                          {notification.priority && notification.priority !== "medium" && (
                            <div className={`w-2 h-2 rounded-full ${getPriorityColor(notification.priority)}`} />
                          )}
                          {!notification.isRead && (
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {notification.createdAt && !isNaN(new Date(notification.createdAt).getTime()) 
                            ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })
                            : "Just now"}
                        </span>
                        
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-1 text-xs opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            disabled={isMarkingAsRead}
                          >
                            <Check className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {(notifications || []).length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={handleViewAll}
              >
                {t("notifications.viewAll")}
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}