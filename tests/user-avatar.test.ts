import { describe, expect, it } from "vitest";
import { userAvatarSrc, userInitials } from "../client/src/lib/user-avatar";

describe("userAvatarSrc", () => {
  it("prefers the account image, then the employee profile image", () => {
    expect(userAvatarSrc({ profileImageUrl: "https://a/x.png", employee: { profileImage: "data:image/png;base64,AA" } })).toBe("https://a/x.png");
    expect(userAvatarSrc({ profileImageUrl: null, employee: { profileImage: "data:image/png;base64,AA" } })).toBe("data:image/png;base64,AA");
  });
  it("returns nothing when there is no picture", () => {
    expect(userAvatarSrc({ profileImageUrl: "", employee: null })).toBeUndefined();
    expect(userAvatarSrc(null)).toBeUndefined();
  });
});

describe("userInitials", () => {
  it("uses first and last name, else the start of the username or email", () => {
    expect(userInitials({ firstName: "Sara", lastName: "Finance" })).toBe("SF");
    expect(userInitials({ username: "test" })).toBe("TE");
    expect(userInitials({ email: "ab@x.co" })).toBe("AB");
    expect(userInitials(null)).toBe("U");
  });
});
