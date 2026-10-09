import { describe, expect, it } from "vitest";
import { decidePushStatus, urlBase64ToUint8Array, type PushFacts } from "../client/src/lib/push-state";

const ok: PushFacts = { supported: true, ios: false, standalone: false, configured: true, permission: "default", subscribed: false };

describe("decidePushStatus", () => {
  it("is off until the person turns it on, and on once permitted and subscribed", () => {
    expect(decidePushStatus(ok)).toBe("off");
    expect(decidePushStatus({ ...ok, permission: "granted", subscribed: true })).toBe("on");
    expect(decidePushStatus({ ...ok, permission: "default", subscribed: true })).toBe("off");
  });
  it("explains why it cannot be turned on", () => {
    expect(decidePushStatus({ ...ok, supported: false })).toBe("unsupported");
    expect(decidePushStatus({ ...ok, configured: false })).toBe("not_configured");
    expect(decidePushStatus({ ...ok, permission: "denied" })).toBe("denied");
  });
  it("asks iPhone users to install the app first, even though Safari lacks the Push API", () => {
    expect(decidePushStatus({ ...ok, supported: false, ios: true, standalone: false })).toBe("needs_install");
    expect(decidePushStatus({ ...ok, ios: true, standalone: true })).toBe("off");
  });
  it("waits while the facts load", () => {
    expect(decidePushStatus({ ...ok, configured: undefined })).toBe("loading");
    expect(decidePushStatus({ ...ok, subscribed: undefined })).toBe("loading");
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodes a base64url key", () => {
    expect(Array.from(urlBase64ToUint8Array("AQID"))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array("-_8"))).toEqual([251, 255]);
  });
});
