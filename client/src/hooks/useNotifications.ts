import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Notification {
  id: string;
  type: 'invoice.paid' | 'client.added' | 'task.assigned' | 'quotation.accepted' | 'system' | 'warning';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  userId?: string;
}

export function useNotifications() {
  const queryClient = useQueryClient();
  
  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to mark notification as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to mark all notifications as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  // Create notification (for internal use)
  const createNotificationMutation = useMutation({
    mutationFn: async (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification),
      });
      if (!response.ok) throw new Error('Failed to create notification');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    createNotification: createNotificationMutation.mutate,
    isMarkingAsRead: markAsReadMutation.isPending,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
  };
}

// Notification context for global toast notifications
export function useToastNotification() {
  const { createNotification } = useNotifications();

  const showSuccess = (title: string, message: string) => {
    createNotification({
      type: 'system',
      title,
      message,
      userId: '1', // Current user - in real app this would come from auth
    });
  };

  const showError = (title: string, message: string) => {
    createNotification({
      type: 'warning',
      title,
      message,
      userId: '1',
    });
  };

  const showInfo = (title: string, message: string) => {
    createNotification({
      type: 'system',
      title,
      message,
      userId: '1',
    });
  };

  return {
    showSuccess,
    showError,
    showInfo,
  };
}