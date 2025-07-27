import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  priority?: "low" | "medium" | "high" | "urgent";
  entityType?: string;
  entityId?: string;
  entityUrl?: string;
  metadata?: any;
  emailSent?: boolean;
  emailSentAt?: string;
  emailError?: string;
  scheduledFor?: string;
  expiresAt?: string;
  readAt?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface NotificationResponse {
  success: boolean;
  data: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
}

export interface UnreadCountResponse {
  success: boolean;
  data: {
    unreadCount: number;
  };
}

export function useNotifications(page: number = 1, limit: number = 20, unreadOnly: boolean = false) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch notifications with pagination
  const notificationsQuery = useQuery({
    queryKey: ["/api/notifications", { page, limit, unreadOnly }],
    queryFn: async (): Promise<Notification[]> => {
      const res = await apiRequest("GET", `/api/notifications?page=${page}&limit=${limit}&unreadOnly=${unreadOnly}`);
      const result = await res.json();
      return result.success ? result.data : [];
    },
    staleTime: 0, // Always consider data stale for immediate updates
    refetchInterval: unreadOnly ? 5000 : 10000, // More frequent updates for real-time experience
  });

  // Fetch unread count separately for navbar badge
  const unreadCountQuery = useQuery({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: async (): Promise<UnreadCountResponse> => {
      const res = await apiRequest("GET", "/api/notifications/unread-count");
      return await res.json();
    },
    staleTime: 0, // Always consider data stale for immediate updates
    refetchInterval: 3000, // Update every 3 seconds for real-time badge
  });

  // Mark single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate notifications and unread count with more aggressive cache clearing
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ["/api/notifications"] });
      queryClient.refetchQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    },
  });

  // Mark multiple notifications as read
  const markMultipleAsReadMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      const res = await apiRequest("PATCH", "/api/notifications/mark-all-read");
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate and force refetch
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ["/api/notifications"] });
      queryClient.refetchQueries({ queryKey: ["/api/notifications/unread-count"] });
      
      toast({
        title: "Success",
        description: "Notifications marked as read",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to mark notifications as read",
        variant: "destructive",
      });
    },
  });



  return {
    // Data
    notifications: notificationsQuery.data || [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
    allNotificationsUnreadCount: 0,
    unreadCount: (unreadCountQuery.data as any)?.data?.unreadCount || 0,
    
    // Loading states
    isLoading: notificationsQuery.isLoading,
    isUnreadCountLoading: unreadCountQuery.isLoading,
    
    // Error states
    error: notificationsQuery.error,
    unreadCountError: unreadCountQuery.error,
    
    // Mutations
    markAsRead: markAsReadMutation.mutate,
    markMultipleAsRead: markMultipleAsReadMutation.mutate,
    
    // Mutation states
    isMarkingAsRead: markAsReadMutation.isPending,
    isMarkingMultipleAsRead: markMultipleAsReadMutation.isPending,
    
    // Refetch functions
    refetch: notificationsQuery.refetch,
    refetchUnreadCount: unreadCountQuery.refetch,
  };
}

export function useNotificationSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch notification settings
  const settingsQuery = useQuery({
    queryKey: ["/api/notifications/settings"],
    staleTime: 300000, // 5 minutes
  });

  // Update notification settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: {
      notificationType: string;
      inAppEnabled?: boolean;
      emailEnabled?: boolean;
      pushEnabled?: boolean;
    }) => {
      const res = await apiRequest("PUT", "/api/notifications/settings", settings);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
      toast({
        title: "Success",
        description: "Notification settings updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to update notification settings",
        variant: "destructive",
      });
    },
  });

  return {
    settings: (settingsQuery.data as any)?.data || [],
    isLoading: settingsQuery.isLoading,
    error: settingsQuery.error,
    updateSettings: updateSettingsMutation.mutate,
    isUpdating: updateSettingsMutation.isPending,
    refetch: settingsQuery.refetch,
  };
}