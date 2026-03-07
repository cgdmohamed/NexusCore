import type { Express } from "express";
import { db } from "./db";
import { conversations, conversationParticipants, messages, users } from "@shared/schema";
import { eq, and, sql, ne, inArray } from "drizzle-orm";
import { requireAuth } from "./auth";
import { notificationService } from "./notification-service";
import nodemailer from "nodemailer";

const smtpPort = parseInt(process.env.SMTP_PORT || "587");
const smtpTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendMessageEmail(
  toEmail: string,
  toName: string,
  senderName: string,
  preview: string
) {
  if (!process.env.SMTP_USER) return;
  const appName = process.env.COMPANY_NAME || "CompanyOS";
  const appUrl = process.env.APP_URL || "https://localhost:5000";
  try {
    await smtpTransporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || appName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: toEmail,
      subject: `New message from ${senderName} — ${appName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#1a1a2e">You have a new message</h2>
          <p><strong>${senderName}</strong> sent you a message in ${appName}:</p>
          <div style="background:#f5f5f5;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:4px;margin:16px 0">
            <p style="margin:0;color:#374151">${preview}</p>
          </div>
          <a href="${appUrl}/messages" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px">
            Open Messages
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">This email was sent automatically by ${appName}.</p>
        </div>
      `,
      text: `New message from ${senderName}:\n\n${preview}\n\nOpen Messages: ${appUrl}/messages`,
    });
  } catch (err) {
    console.error("[Messaging] Failed to send email notification:", err);
  }
}

export function registerMessagingRoutes(app: Express) {
  // GET /api/users/directory — lightweight user list for messaging (all authenticated users)
  app.get("/api/users/directory", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const usersList = await db
        .select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.isActive, true));
      // Exclude self
      const filtered = usersList.filter((u) => u.id !== userId);
      res.json(filtered);
    } catch (error) {
      console.error("Error fetching user directory:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // GET /api/conversations — list the current user's conversations
  app.get("/api/conversations", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      // Find all conversation IDs the user participates in
      const userParticipations = await db
        .select()
        .from(conversationParticipants)
        .where(eq(conversationParticipants.userId, userId));

      if (userParticipations.length === 0) {
        return res.json([]);
      }

      const conversationIds = userParticipations.map((p) => p.conversationId);

      // For each conversation, gather details
      const result = await Promise.all(
        conversationIds.map(async (convId) => {
          // Get the other participant
          const allParticipants = await db
            .select()
            .from(conversationParticipants)
            .where(
              and(
                eq(conversationParticipants.conversationId, convId),
                ne(conversationParticipants.userId, userId)
              )
            );

          const otherParticipant = allParticipants[0];
          let otherUser = null;
          if (otherParticipant) {
            const [u] = await db
              .select()
              .from(users)
              .where(eq(users.id, otherParticipant.userId));
            otherUser = u;
          }

          // Last message
          const [lastMessage] = await db
            .select()
            .from(messages)
            .where(eq(messages.conversationId, convId))
            .orderBy(sql`${messages.createdAt} DESC`)
            .limit(1);

          // Unread count: messages after my lastReadAt
          const myParticipation = userParticipations.find(
            (p) => p.conversationId === convId
          );
          let unreadCount = 0;
          if (myParticipation) {
            if (!myParticipation.lastReadAt) {
              const [countResult] = await db
                .select({ count: sql<number>`COUNT(*)` })
                .from(messages)
                .where(
                  and(
                    eq(messages.conversationId, convId),
                    ne(messages.senderId, userId)
                  )
                );
              unreadCount = Number(countResult?.count || 0);
            } else {
              const [countResult] = await db
                .select({ count: sql<number>`COUNT(*)` })
                .from(messages)
                .where(
                  and(
                    eq(messages.conversationId, convId),
                    ne(messages.senderId, userId),
                    sql`${messages.createdAt} > ${myParticipation.lastReadAt}`
                  )
                );
              unreadCount = Number(countResult?.count || 0);
            }
          }

          return {
            id: convId,
            otherUser: otherUser
              ? {
                  id: otherUser.id,
                  name: `${otherUser.firstName || ""} ${otherUser.lastName || ""}`.trim() || otherUser.username,
                  username: otherUser.username,
                }
              : null,
            lastMessage: lastMessage
              ? {
                  content: lastMessage.content,
                  createdAt: lastMessage.createdAt,
                  senderId: lastMessage.senderId,
                }
              : null,
            unreadCount,
          };
        })
      );

      // Sort by last message time desc
      result.sort((a, b) => {
        const aTime = a.lastMessage?.createdAt
          ? new Date(a.lastMessage.createdAt).getTime()
          : 0;
        const bTime = b.lastMessage?.createdAt
          ? new Date(b.lastMessage.createdAt).getTime()
          : 0;
        return bTime - aTime;
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // POST /api/conversations — find or create a DM conversation
  app.post("/api/conversations", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const { participantId } = req.body;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!participantId) return res.status(400).json({ message: "participantId is required" });
      if (participantId === userId) return res.status(400).json({ message: "Cannot start a conversation with yourself" });

      // Find existing conversation between these two users
      const myConvs = await db
        .select({ conversationId: conversationParticipants.conversationId })
        .from(conversationParticipants)
        .where(eq(conversationParticipants.userId, userId));

      const myConvIds = myConvs.map((r) => r.conversationId);

      if (myConvIds.length > 0) {
        const theirConvs = await db
          .select({ conversationId: conversationParticipants.conversationId })
          .from(conversationParticipants)
          .where(
            and(
              eq(conversationParticipants.userId, participantId),
              inArray(conversationParticipants.conversationId, myConvIds)
            )
          );

        if (theirConvs.length > 0) {
          const existingId = theirConvs[0].conversationId;
          return res.json({ id: existingId, isExisting: true });
        }
      }

      // Create new conversation
      const [newConv] = await db.insert(conversations).values({}).returning();

      await db.insert(conversationParticipants).values([
        { conversationId: newConv.id, userId },
        { conversationId: newConv.id, userId: participantId },
      ]);

      res.status(201).json({ id: newConv.id, isExisting: false });
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // GET /api/conversations/:id/messages
  app.get("/api/conversations/:id/messages", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const convId = req.params.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      // Verify participation
      const [participation] = await db
        .select()
        .from(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.conversationId, convId),
            eq(conversationParticipants.userId, userId)
          )
        );
      if (!participation) return res.status(403).json({ message: "Not a participant" });

      const msgs = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, convId))
        .orderBy(sql`${messages.createdAt} ASC`);

      // Attach sender names
      const senderIds = [...new Set(msgs.map((m) => m.senderId).filter(Boolean))] as string[];
      let senderMap: Record<string, string> = {};
      if (senderIds.length > 0) {
        const senderUsers = await db
          .select()
          .from(users)
          .where(inArray(users.id, senderIds));
        senderMap = Object.fromEntries(
          senderUsers.map((u) => [
            u.id,
            `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username,
          ])
        );
      }

      const enriched = msgs.map((m) => ({
        ...m,
        senderName: m.senderId ? senderMap[m.senderId] || "Unknown" : "Unknown",
      }));

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // POST /api/conversations/:id/messages — send a message
  app.post("/api/conversations/:id/messages", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const convId = req.params.id;
      const { content } = req.body;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!content?.trim()) return res.status(400).json({ message: "Message content is required" });

      // Verify participation
      const [participation] = await db
        .select()
        .from(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.conversationId, convId),
            eq(conversationParticipants.userId, userId)
          )
        );
      if (!participation) return res.status(403).json({ message: "Not a participant" });

      // Insert message
      const [newMsg] = await db
        .insert(messages)
        .values({ conversationId: convId, senderId: userId, content: content.trim() })
        .returning();

      // Get sender details
      const [sender] = await db.select().from(users).where(eq(users.id, userId));
      const senderName =
        `${sender?.firstName || ""} ${sender?.lastName || ""}`.trim() || sender?.username || "Someone";

      // Notify other participants
      const otherParticipants = await db
        .select()
        .from(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.conversationId, convId),
            ne(conversationParticipants.userId, userId)
          )
        );

      const preview = content.trim().length > 100 ? content.trim().slice(0, 100) + "…" : content.trim();

      for (const participant of otherParticipants) {
        // In-app notification
        try {
          await notificationService.createNotification({
            userId: participant.userId,
            type: "direct_message",
            title: `New message from ${senderName}`,
            message: preview,
            priority: "medium",
            entityType: "message",
            entityId: newMsg.id,
            entityUrl: "/messages",
            createdBy: userId,
          });
        } catch (notifErr) {
          console.error("[Messaging] Failed to create in-app notification:", notifErr);
        }

        // Email notification
        try {
          const [recipientUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, participant.userId));
          if (recipientUser?.email) {
            const recipientName =
              `${recipientUser.firstName || ""} ${recipientUser.lastName || ""}`.trim() ||
              recipientUser.username;
            await sendMessageEmail(recipientUser.email, recipientName, senderName, preview);
          }
        } catch (emailErr) {
          console.error("[Messaging] Failed to send email notification:", emailErr);
        }
      }

      res.status(201).json({
        ...newMsg,
        senderName,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // PATCH /api/conversations/:id/read — mark conversation as read
  app.patch("/api/conversations/:id/read", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const convId = req.params.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      await db
        .update(conversationParticipants)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(conversationParticipants.conversationId, convId),
            eq(conversationParticipants.userId, userId)
          )
        );

      res.json({ success: true });
    } catch (error) {
      console.error("Error marking conversation read:", error);
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  // GET /api/messages/unread-count — total unread messages for the current user
  app.get("/api/messages/unread-count", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const participations = await db
        .select()
        .from(conversationParticipants)
        .where(eq(conversationParticipants.userId, userId));

      let total = 0;
      for (const p of participations) {
        let condition;
        if (!p.lastReadAt) {
          condition = and(
            eq(messages.conversationId, p.conversationId),
            ne(messages.senderId, userId)
          );
        } else {
          condition = and(
            eq(messages.conversationId, p.conversationId),
            ne(messages.senderId, userId),
            sql`${messages.createdAt} > ${p.lastReadAt}`
          );
        }
        const [row] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(messages)
          .where(condition);
        total += Number(row?.count || 0);
      }

      res.json({ unreadCount: total });
    } catch (error) {
      console.error("Error fetching unread message count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });
}
