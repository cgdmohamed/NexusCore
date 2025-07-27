import { db } from "./db";
import { 
  notifications, 
  notificationSettings, 
  emailTemplates, 
  notificationLogs,
  users,
  type InsertNotification, 
  type InsertNotificationLog,
  type Notification
} from "@shared/schema";
import { eq, and, desc, count, inArray, sql } from "drizzle-orm";

export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  priority?: "low" | "medium" | "high" | "urgent";
  entityType?: string;
  entityId?: string;
  entityUrl?: string;
  metadata?: any;
  scheduledFor?: Date;
  expiresAt?: Date;
  createdBy?: string;
}

export interface EmailPayload {
  to: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  metadata?: any;
}

class NotificationService {
  
  /**
   * Create and send a notification to a user
   */
  async createNotification(payload: NotificationPayload): Promise<Notification> {
    // Check user notification settings
    const userSettings = await db
      .select()
      .from(notificationSettings)
      .where(
        and(
          eq(notificationSettings.userId, payload.userId),
          eq(notificationSettings.notificationType, payload.type as any)
        )
      );

    // Create the notification
    const [notification] = await db
      .insert(notifications)
      .values({
        userId: payload.userId,
        type: payload.type as any,
        title: payload.title,
        message: payload.message,
        priority: payload.priority || "medium",
        entityType: payload.entityType,
        entityId: payload.entityId,
        entityUrl: payload.entityUrl,
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
        scheduledFor: payload.scheduledFor,
        expiresAt: payload.expiresAt,
        createdBy: payload.createdBy,
      })
      .returning();

    // Log the notification creation
    await this.logNotification(notification.id, "sent", "in_app", true);

    // Send email if enabled for this user and notification type
    const setting = userSettings.find(s => s.notificationType === payload.type);
    if (!setting || setting.emailEnabled) {
      await this.sendEmailNotification(notification);
    }

    return notification;
  }

  /**
   * Create notifications for multiple users
   */
  async createBulkNotifications(userIds: string[], payload: Omit<NotificationPayload, 'userId'>): Promise<Notification[]> {
    const notifications = [];
    
    for (const userId of userIds) {
      const notification = await this.createNotification({
        ...payload,
        userId
      });
      notifications.push(notification);
    }

    return notifications;
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: Notification): Promise<void> {
    try {
      // Get user details
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, notification.userId));

      if (!user || !user.email) {
        throw new Error("User email not found");
      }

      // Get email template
      const [template] = await db
        .select()
        .from(emailTemplates)
        .where(
          and(
            eq(emailTemplates.notificationType, notification.type),
            eq(emailTemplates.isActive, true)
          )
        );

      if (!template) {
        // Use default template
        const emailPayload: EmailPayload = {
          to: [user.email],
          subject: notification.title,
          bodyHtml: `<h2>${notification.title}</h2><p>${notification.message}</p>`,
          bodyText: `${notification.title}\n\n${notification.message}`,
          metadata: {
            notificationId: notification.id,
            entityType: notification.entityType,
            entityId: notification.entityId
          }
        };

        await this.sendEmail(emailPayload);
      } else {
        // Use template with variable substitution
        const variables = {
          user_name: `${user.firstName} ${user.lastName}`,
          user_email: user.email,
          notification_title: notification.title,
          notification_message: notification.message,
          entity_url: notification.entityUrl || '#',
          metadata: notification.metadata ? JSON.parse(notification.metadata as string) : {}
        };

        const subject = this.replaceVariables(template.subject, variables);
        const bodyHtml = this.replaceVariables(template.bodyHtml, variables);
        const bodyText = this.replaceVariables(template.bodyText, variables);

        const emailPayload: EmailPayload = {
          to: [user.email],
          subject,
          bodyHtml,
          bodyText,
          metadata: {
            notificationId: notification.id,
            templateId: template.id
          }
        };

        await this.sendEmail(emailPayload);
      }

      // Update notification as email sent
      await db
        .update(notifications)
        .set({
          emailSent: true,
          emailSentAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(notifications.id, notification.id));

      await this.logNotification(notification.id, "delivered", "email", true);

    } catch (error) {
      console.error("Email notification failed:", error);
      
      // Update notification with error
      await db
        .update(notifications)
        .set({
          emailError: error instanceof Error ? error.message : "Unknown error",
          updatedAt: new Date()
        })
        .where(eq(notifications.id, notification.id));

      await this.logNotification(notification.id, "failed", "email", false, error instanceof Error ? error.message : "Unknown error");
    }
  }

  /**
   * Replace template variables
   */
  private replaceVariables(template: string, variables: Record<string, any>): string {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return result;
  }

  /**
   * Send email using configured provider
   */
  private async sendEmail(payload: EmailPayload): Promise<void> {
    // For now, we'll log the email (in production, integrate with SMTP/SendGrid/etc.)
    console.log("📧 Email would be sent:", {
      to: payload.to,
      subject: payload.subject,
      body: payload.bodyText
    });

    // TODO: Integrate with actual email service
    // Examples:
    // - NodeMailer for SMTP
    // - SendGrid API
    // - AWS SES
    // - Mailgun API
  }

  /**
   * Log notification activity
   */
  private async logNotification(
    notificationId: string, 
    action: string, 
    channel: string, 
    success: boolean, 
    errorMessage?: string,
    metadata?: any
  ): Promise<void> {
    try {
      await db.insert(notificationLogs).values({
        notificationId,
        action,
        channel,
        success,
        errorMessage,
        metadata: metadata ? JSON.stringify(metadata) : null
      });
    } catch (error) {
      // For now, just log to console if notification_logs table doesn't exist
      console.log(`📝 Notification log: ${action} ${channel} for ${notificationId} - ${success ? 'success' : 'failed'}`);
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await db.execute(sql`
      UPDATE notifications 
      SET is_read = true, updated_at = ${new Date().toISOString()}
      WHERE id = ${notificationId} AND user_id = ${userId}
    `);

    await this.logNotification(notificationId, "read", "in_app", true);
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(notificationIds: string[], userId: string): Promise<void> {
    const idList = notificationIds.map(id => `'${id}'`).join(',');
    await db.execute(sql`
      UPDATE notifications 
      SET is_read = true, updated_at = ${new Date().toISOString()}
      WHERE id IN (${sql.raw(idList)}) AND user_id = ${userId}
    `);

    // Log each notification
    for (const id of notificationIds) {
      await this.logNotification(id, "read", "in_app", true);
    }
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    userId: string, 
    page: number = 1, 
    limit: number = 20,
    unreadOnly: boolean = false
  ): Promise<{ notifications: Notification[], total: number, unreadCount: number }> {
    const offset = (page - 1) * limit;
    
    const whereClause = unreadOnly 
      ? sql`user_id = ${userId} AND is_read = false`
      : sql`user_id = ${userId}`;

    // Get notifications using raw SQL for consistency
    const notificationsQuery = unreadOnly 
      ? sql`SELECT * FROM notifications WHERE user_id = ${userId} AND is_read = false ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
      : sql`SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const notificationsResult = await db.execute(notificationsQuery);
    const userNotifications = notificationsResult.rows as Notification[];

    // Get total count
    const totalResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM notifications 
      WHERE user_id = ${userId}
    `);
    const totalCount = Number((totalResult.rows[0] as any)?.count || 0);

    // Get unread count  
    let unreadCount = 0;
    try {
      const unreadResult = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM notifications 
        WHERE user_id = ${userId} AND is_read = false
      `);
      unreadCount = Number((unreadResult.rows[0] as any)?.count || 0);
    } catch (error) {
      console.error('Error getting unread count in getUserNotifications:', error);
    }

    return {
      notifications: userNotifications,
      total: totalCount,
      unreadCount
    };
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM notifications 
        WHERE user_id = ${userId} AND is_read = false
      `);
      
      return Number((result.rows[0] as any)?.count || 0);
    } catch (error) {
      console.log('⚠️ Notifications table not found - returning 0 count');
      return 0;
    }
  }

  /**
   * Helper methods for specific notification types
   */

  // Task notifications
  async notifyTaskAssigned(taskId: string, assignedUserId: string, assignedByUserId: string, taskTitle: string): Promise<void> {
    await this.createNotification({
      userId: assignedUserId,
      type: "task_assigned",
      title: "New Task Assigned",
      message: `You have been assigned a new task: "${taskTitle}"`,
      priority: "medium",
      entityType: "task",
      entityId: taskId,
      entityUrl: `/tasks/${taskId}`,
      metadata: { taskTitle, assignedBy: assignedByUserId },
      createdBy: assignedByUserId
    });
  }

  // Expense notifications
  async notifyExpenseSubmitted(expenseId: string, submittedByUserId: string, expenseTitle: string, amount: number): Promise<void> {
    // Notify managers/admins
    const managers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          inArray(users.role, ["admin", "manager"])
        )
      );

    const managerIds = managers.map(m => m.id).filter(id => id !== submittedByUserId);

    await this.createBulkNotifications(managerIds, {
      type: "expense_submitted",
      title: "New Expense Submitted",
      message: `New expense "${expenseTitle}" submitted for approval (${amount})`,
      priority: "medium",
      entityType: "expense",
      entityId: expenseId,
      entityUrl: `/expenses/${expenseId}`,
      metadata: { expenseTitle, amount, submittedBy: submittedByUserId },
      createdBy: submittedByUserId
    });
  }

  // Invoice notifications
  async notifyInvoicePaid(invoiceId: string, clientName: string, amount: number, paidByUserId?: string): Promise<void> {
    // Notify all finance and management users
    const relevantUsers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          inArray(users.department, ["finance", "management"])
        )
      );

    const userIds = relevantUsers.map(u => u.id);

    await this.createBulkNotifications(userIds, {
      type: "invoice_paid",
      title: "Invoice Payment Received",
      message: `Payment received for invoice from ${clientName} (${amount})`,
      priority: "high",
      entityType: "invoice",
      entityId: invoiceId,
      entityUrl: `/invoices/${invoiceId}`,
      metadata: { clientName, amount, paidBy: paidByUserId },
      createdBy: paidByUserId
    });
  }

  // Quotation notifications
  async notifyQuotationAccepted(quotationId: string, clientName: string, amount: number, acceptedByUserId?: string): Promise<void> {
    // Notify sales and management
    const relevantUsers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          inArray(users.department, ["sales", "management"])
        )
      );

    const userIds = relevantUsers.map(u => u.id);

    await this.createBulkNotifications(userIds, {
      type: "quotation_accepted",
      title: "Quotation Accepted",
      message: `Quotation accepted by ${clientName} (${amount})`,
      priority: "high",
      entityType: "quotation",
      entityId: quotationId,
      entityUrl: `/quotations/${quotationId}`,
      metadata: { clientName, amount },
      createdBy: acceptedByUserId
    });
  }

  // KPI notifications
  async notifyKpiAssigned(kpiId: string, employeeId: string, assignedByUserId: string, kpiTitle: string): Promise<void> {
    // Get the user ID for the employee
    const [employee] = await db
      .select()
      .from(users)
      .where(eq(users.employeeId, employeeId));

    if (employee) {
      await this.createNotification({
        userId: employee.id,
        type: "kpi_assigned",
        title: "New KPI Assigned",
        message: `You have been assigned a new KPI: "${kpiTitle}"`,
        priority: "medium",
        entityType: "kpi",
        entityId: kpiId,
        entityUrl: `/employees/${employeeId}`,
        metadata: { kpiTitle, assignedBy: assignedByUserId },
        createdBy: assignedByUserId
      });
    }
  }
}

export const notificationService = new NotificationService();