import { describe, expect, it } from "vitest";
import { chatTitle } from "../server/ai-chat/agent";

describe("chatTitle", () => {
  it("uses the first message on one line", () => {
    expect(chatTitle("  أنشئ   عميلاً\n  جديداً ")).toBe("أنشئ عميلاً جديداً");
  });
  it("shortens a long message with an ellipsis", () => {
    const t = chatTitle("x".repeat(100));
    expect(t).toHaveLength(40);
    expect(t.endsWith("…")).toBe(true);
  });
  it("is empty when there is nothing to name it by", () => {
    expect(chatTitle(null)).toBe("");
    expect(chatTitle("   ")).toBe("");
  });
});
