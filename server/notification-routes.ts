import { Router } from "express";
import { notificationService } from "./notification-service";
import { db } from "./db";
import { notificationSettings, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "./auth";

const router = Router();

router.use(requireAuth);

/**
 * Get user notifications with pagination
 * GET /api/notifications?page=1&limit=20&unreadOnly=false
 */
router.get("/", async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const unreadOnly = req.query.unreadOnly === "true";

    const result = await notificationService.getUserNotifications(userId, page, limit, unreadOnly);

    res.json({
      success: true,
      data: result.notifications,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit)
      },
      unreadCount: result.unreadCount
    });
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
});

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 */
router.get("/unread-count", async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { unreadCount: count }
    });
  } catch (error) {
    console.error("Failed to fetch unread count:", error);
    res.status(500).json({ success: false, message: "Failed to fetch unread count" });
  }
});

/**
 * Mark single notification as read
 * PATCH /api/notifications/:id/read
 */
router.patch("/:id/read", async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const notificationId = req.params.id;
    await notificationService.markAsRead(notificationId, userId);

    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    res.status(500).json({ success: false, message: "Failed to mark notification as read" });
  }
});

/**
 * Mark all notifications as read
 * PATCH /api/notifications/mark-all-read
 */
router.patch("/mark-all-read", async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    await notificationService.markAllAsRead(userId);

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Failed to mark all notifications as read:", error);
    res.status(500).json({ success: false, message: "Failed to mark all notifications as read" });
  }
});

/**
 * Get user notification settings
 * GET /api/notifications/settings
 */
router.get("/settings", async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const settings = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId));

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error("Failed to fetch notification settings:", error);
    res.status(500).json({ success: false, message: "Failed to fetch notification settings" });
  }
});

/**
 * Update user notification settings
 * PUT /api/notifications/settings
 */
router.put("/settings", async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { notificationType, inAppEnabled, emailEnabled, pushEnabled } = req.body;

    if (!notificationType) {
      return res.status(400).json({ success: false, message: "notificationType is required" });
    }

    const existingSetting = await db
      .select()
      .from(notificationSettings)
      .where(
        and(
          eq(notificationSettings.userId, userId),
          eq(notificationSettings.notificationType, notificationType)
        )
      );

    if (existingSetting.length > 0) {
      await db
        .update(notificationSettings)
        .set({
          inAppEnabled: inAppEnabled ?? existingSetting[0].inAppEnabled,
          emailEnabled: emailEnabled ?? existingSetting[0].emailEnabled,
          pushEnabled: pushEnabled ?? existingSetting[0].pushEnabled,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(notificationSettings.userId, userId),
            eq(notificationSettings.notificationType, notificationType)
          )
        );
    } else {
      await db
        .insert(notificationSettings)
        .values({
          userId,
          notificationType,
          inAppEnabled: inAppEnabled ?? true,
          emailEnabled: emailEnabled ?? true,
          pushEnabled: pushEnabled ?? false
        });
    }

    res.json({ success: true, message: "Notification settings updated" });
  } catch (error) {
    console.error("Failed to update notification settings:", error);
    res.status(500).json({ success: false, message: "Failed to update notification settings" });
  }
});

/**
 * Test notification (admin only)
 * POST /api/notifications/test
 */
router.post("/test", requireAdmin, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const { type, title, message, targetUserId } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({ success: false, message: "type, title, and message are required" });
    }

    const notification = await notificationService.createNotification({
      userId: targetUserId || userId,
      type,
      title,
      message,
      priority: "medium",
      entityType: "test",
      entityId: "test-notification",
      createdBy: userId
    });

    res.json({ success: true, message: "Test notification sent", data: notification });
  } catch (error) {
    console.error("Failed to send test notification:", error);
    res.status(500).json({ success: false, message: "Failed to send test notification" });
  }
});

/**
 * Create system notification (admin only)
 * POST /api/notifications/system
 */
router.post("/system", requireAdmin, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const { type, title, message, targetUsers, priority, entityType, entityId, entityUrl } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({ success: false, message: "type, title, and message are required" });
    }

    let userIds: string[] = [];

    if (targetUsers === "all") {
      const allUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.isActive, true));
      userIds = allUsers.map(u => u.id);
    } else if (Array.isArray(targetUsers)) {
      userIds = targetUsers;
    } else {
      return res.status(400).json({ success: false, message: "targetUsers must be 'all' or an array of user IDs" });
    }

    const notifications = await notificationService.createBulkNotifications(userIds, {
      type,
      title,
      message,
      priority: priority || "medium",
      entityType,
      entityId,
      entityUrl,
      createdBy: userId
    });

    res.json({
      success: true,
      message: `System notification sent to ${notifications.length} users`,
      data: { sentCount: notifications.length }
    });
  } catch (error) {
    console.error("Failed to send system notification:", error);
    res.status(500).json({ success: false, message: "Failed to send system notification" });
  }
});

export default router;
