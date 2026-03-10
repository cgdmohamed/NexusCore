/**
 * Deferred email notifications for direct messages.
 *
 * Strategy:
 * - In-app notifications are handled separately (immediately).
 * - When a message arrives, start a countdown (EMAIL_DELAY_MS) before sending an email.
 * - If more messages arrive in the same conversation+recipient window, reset the timer
 *   and batch the previews into a single summary email (no duplicate emails).
 * - If the recipient reads the conversation before the timer fires, cancel the email.
 * - Timers are in-memory (Node.js setTimeout). A server restart clears pending timers —
 *   this is acceptable as a lightweight trade-off (requirement 7).
 */

import nodemailer from "nodemailer";
import { db } from "./db";
import { users, conversationParticipants } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const EMAIL_DELAY_MS = 3 * 60 * 1000; // 3 minutes

interface PendingEmail {
  timerId: NodeJS.Timeout;
  recipientId: string;
  conversationId: string;
  messages: Array<{ senderName: string; preview: string }>;
}

const pendingEmails = new Map<string, PendingEmail>();

function pendingKey(recipientId: string, conversationId: string) {
  return `${recipientId}:${conversationId}`;
}

/**
 * Queue a deferred email for a recipient in a conversation.
 * Resets the timer if one is already pending (debounce), batching messages.
 */
export function scheduleMessageEmail(
  recipientId: string,
  conversationId: string,
  senderName: string,
  preview: string
): void {
  const key = pendingKey(recipientId, conversationId);
  const existing = pendingEmails.get(key);

  if (existing) {
    clearTimeout(existing.timerId);
    existing.messages.push({ senderName, preview });
  }

  const messages = existing ? existing.messages : [{ senderName, preview }];

  const timerId = setTimeout(async () => {
    pendingEmails.delete(key);
    await sendDeferredEmail(recipientId, conversationId, messages);
  }, EMAIL_DELAY_MS);

  pendingEmails.set(key, { timerId, recipientId, conversationId, messages });
}

/**
 * Cancel a pending deferred email (call when recipient opens/reads the conversation).
 */
export function cancelMessageEmail(recipientId: string, conversationId: string): void {
  const key = pendingKey(recipientId, conversationId);
  const existing = pendingEmails.get(key);
  if (existing) {
    clearTimeout(existing.timerId);
    pendingEmails.delete(key);
  }
}

/**
 * Cancel ALL pending deferred emails for a recipient across all conversations.
 * Call this when the user opens the Messages page (general read).
 */
export function cancelAllMessageEmails(recipientId: string): void {
  for (const [key, pending] of pendingEmails.entries()) {
    if (pending.recipientId === recipientId) {
      clearTimeout(pending.timerId);
      pendingEmails.delete(key);
    }
  }
}

async function sendDeferredEmail(
  recipientId: string,
  conversationId: string,
  messages: Array<{ senderName: string; preview: string }>
): Promise<void> {
  try {
    // Verify the recipient still hasn't read the conversation recently
    const [participation] = await db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.userId, recipientId),
          eq(conversationParticipants.conversationId, conversationId)
        )
      );

    if (participation?.lastReadAt) {
      const sinceRead = Date.now() - new Date(participation.lastReadAt).getTime();
      if (sinceRead < EMAIL_DELAY_MS) {
        return;
      }
    }

    const [recipient] = await db
      .select()
      .from(users)
      .where(eq(users.id, recipientId));

    if (!recipient?.email) return;

    const replitDomains = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
    const appUrl =
      process.env.APP_URL ||
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "") ||
      (replitDomains ? `https://${replitDomains}` : "");
    const messagesUrl = appUrl ? `${appUrl}/messages` : "";

    const fromName = process.env.SMTP_FROM_NAME || process.env.COMPANY_NAME || "Notifications";
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || "";

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("[Messaging Email] SMTP not configured, skipping email to", recipient.email);
      return;
    }

    const isBatch = messages.length > 1;
    const firstSender = messages[0].senderName;
    const subject = isBatch
      ? `You have ${messages.length} new messages`
      : `New message from ${firstSender}`;

    const messageRows = messages
      .map(
        (m) => `
        <tr>
          <td style="padding:8px 0; border-bottom:1px solid #f0f0f0;">
            <strong style="color:#333;">${escHtml(m.senderName)}</strong>
            <span style="color:#666; margin-left:8px;">${escHtml(m.preview)}</span>
          </td>
        </tr>`
      )
      .join("");

    const bodyHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f9f9f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#4f46e5;padding:24px 32px;">
              <h1 style="margin:0;color:#fff;font-size:20px;">${escHtml(fromName)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#333;">
                ${isBatch
                  ? `You have <strong>${messages.length} new messages</strong> while you were away:`
                  : `<strong>${escHtml(firstSender)}</strong> sent you a message:`}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:6px;padding:0 16px;">
                ${messageRows}
              </table>
              ${messagesUrl ? `<p style="margin:24px 0 0;text-align:center;">
                <a href="${messagesUrl}"
                   style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">
                  Open Messages
                </a>
              </p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background:#f9f9f9;text-align:center;color:#aaa;font-size:12px;">
              You received this because you had unread messages. Log in to manage notification preferences.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const bodyText = isBatch
      ? `You have ${messages.length} new messages.\n\n${messages.map((m) => `${m.senderName}: ${m.preview}`).join("\n")}${messagesUrl ? `\n\nOpen: ${messagesUrl}` : ""}`
      : `${firstSender}: ${messages[0].preview}${messagesUrl ? `\n\nOpen: ${messagesUrl}` : ""}`;

    const smtpPort = parseInt(process.env.SMTP_PORT || "587");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipient.email,
      subject,
      text: bodyText,
      html: bodyHtml,
    });

    console.log(`[Messaging Email] Sent summary email to ${recipient.email} (${messages.length} message(s))`);
  } catch (err) {
    console.error("[Messaging Email] Failed to send deferred email:", err);
  }
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
