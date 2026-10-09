import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startApp, TEST_DATABASE_URL } from "./helpers";

describe.skipIf(!TEST_DATABASE_URL)("reading a conversation (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
  });
  afterAll(async () => {
    await ctx?.close();
  });

  it("clears the message notifications and the unread count, and leaves other notifications alone", async () => {
    const { users, conversations, conversationParticipants, messages } = await import("../../shared/schema");
    const { notificationService } = await import("../../server/notification-service");
    const [other] = await ctx.db.insert(users).values({ username: "colleague", email: "colleague@example.com", passwordHash: "x" }).returning();
    const [conv] = await ctx.db.insert(conversations).values({}).returning();
    await ctx.db.insert(conversationParticipants).values([{ conversationId: conv.id, userId: ctx.currentUserId }, { conversationId: conv.id, userId: other.id }]);
    await ctx.db.insert(messages).values({ conversationId: conv.id, senderId: other.id, content: "Hello" });

    await notificationService.createNotification({ userId: ctx.currentUserId, type: "direct_message", title: "New message", message: "Hello", entityUrl: "/messages" } as any);
    const task = await notificationService.createNotification({ userId: ctx.currentUserId, type: "task_assigned", title: "Task", message: "Do it", entityUrl: "/tasks" } as any);

    expect((await api("GET", "/api/messages/unread-count")).body.unreadCount).toBe(1);
    expect((await api("PATCH", `/api/conversations/${conv.id}/read`)).status).toBe(200);
    expect((await api("GET", "/api/messages/unread-count")).body.unreadCount).toBe(0);

    const list = (await api("GET", "/api/notifications?limit=50")).body.data;
    expect(list.find((n: any) => n.type === "direct_message").isRead).toBe(true);
    expect(list.find((n: any) => n.id === task.id).isRead).toBe(false);
  });
});
