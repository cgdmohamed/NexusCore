import { describe, expect, it } from "vitest";
import { buildPushPayload, pushUrlFor } from "../server/push-service";

describe("pushUrlFor", () => {
  it("keeps the desktop link, falling back to the notifications page", () => {
    expect(pushUrlFor("/invoices/42", "desktop")).toBe("/invoices/42");
    expect(pushUrlFor(null, "desktop")).toBe("/notifications");
  });
  it("sends phone users to the matching screen of the phone app", () => {
    expect(pushUrlFor("/messages", "mobile")).toBe("/m/messages");
    expect(pushUrlFor("/tasks?task=1", "mobile")).toBe("/m/tasks");
    expect(pushUrlFor("/projects/9", "mobile")).toBe("/m/projects");
    expect(pushUrlFor("/clients/3", "mobile")).toBe("/m/clients");
    expect(pushUrlFor("/invoices/7", "mobile")).toBe("/m/alerts");
    expect(pushUrlFor(undefined, "mobile")).toBe("/m/alerts");
  });
});

describe("buildPushPayload", () => {
  it("carries what the service worker needs to show and open the notification", () => {
    expect(buildPushPayload({ type: "task_assigned", title: "T", message: "M", entityUrl: "/tasks", notificationId: "abc" }, "mobile")).toEqual({
      title: "T", body: "M", url: "/m/tasks", tag: "n-abc", type: "task_assigned",
    });
  });
});
