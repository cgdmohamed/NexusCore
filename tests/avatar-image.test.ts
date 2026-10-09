import { describe, expect, it } from "vitest";
import { parseAvatar } from "../server/avatar-image";

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(8)]);

describe("parseAvatar", () => {
  it("redirects to an https address and refuses other schemes", () => {
    expect(parseAvatar("https://images.example.com/a.jpg?w=100")).toEqual({ kind: "redirect", url: "https://images.example.com/a.jpg?w=100" });
    expect(parseAvatar("http://insecure.example.com/a.jpg")).toBeNull();
    expect(parseAvatar("javascript:alert(1)")).toBeNull();
  });
  it("decodes base64 with or without the data: prefix and trusts the bytes, not the label", () => {
    expect(parseAvatar(`data:image/png;base64,${png.toString("base64")}`)).toMatchObject({ kind: "bytes", mime: "image/png" });
    expect(parseAvatar(jpeg.toString("base64"))).toMatchObject({ kind: "bytes", mime: "image/jpeg" });
    expect(parseAvatar(`data:image/png;base64,${webp.toString("base64")}`)).toMatchObject({ kind: "bytes", mime: "image/webp" });
  });
  it("never serves SVG or other non-raster content", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64");
    expect(parseAvatar(`data:image/svg+xml;base64,${svg}`)).toBeNull();
    expect(parseAvatar(svg)).toBeNull();
    expect(parseAvatar("data:text/html;base64,PGh0bWw+")).toBeNull();
  });
  it("ignores empty, malformed and oversized values", () => {
    expect(parseAvatar("")).toBeNull();
    expect(parseAvatar(null)).toBeNull();
    expect(parseAvatar("not base64 at all!")).toBeNull();
    expect(parseAvatar(Buffer.concat([png, Buffer.alloc(3 * 1024 * 1024)]).toString("base64"))).toBeNull();
  });
});
