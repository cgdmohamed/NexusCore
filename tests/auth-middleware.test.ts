import { describe, expect, it, vi } from "vitest";
import { requireAdmin, requireAuth, requirePermission } from "../server/auth";

function run(mw: (req: any, res: any, next: any) => void, req: Record<string, any>) {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  const next = vi.fn();
  mw({ method: "GET", path: "/api/x", isAuthenticated: () => !!req.user, ...req }, res, next);
  return { res, next };
}

const perms = (view = false, edit = false) => ({
  invoices: { view, add: false, edit, delete: false, approve: false },
});

describe("requireAuth", () => {
  it("returns 401 when not logged in", () => {
    const { res, next } = run(requireAuth, {});
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 for disabled accounts", () => {
    const { res, next } = run(requireAuth, { user: { id: "1", isActive: false }, logout: vi.fn() });
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks users who must change their password", () => {
    const { res } = run(requireAuth, { user: { id: "1", mustChangePassword: true } });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("MUST_CHANGE_PASSWORD");
  });

  it("still allows the change-password endpoint", () => {
    const { next } = run(requireAuth, {
      method: "PUT",
      path: "/api/users/1/change-password",
      user: { id: "1", mustChangePassword: true },
    });
    expect(next).toHaveBeenCalled();
  });

  it("allows an active user", () => {
    const { next } = run(requireAuth, { user: { id: "1", isActive: true } });
    expect(next).toHaveBeenCalled();
  });
});

describe("requireAdmin", () => {
  it("rejects non-admin roles", () => {
    const { res, next } = run(requireAdmin, { user: { id: "1", roleName: "Manager" } });
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows Admin", () => {
    const { next } = run(requireAdmin, { user: { id: "1", roleName: "Admin" } });
    expect(next).toHaveBeenCalled();
  });
});

describe("requirePermission", () => {
  const mw = requirePermission("invoices", "edit");

  it("rejects users without any permissions", () => {
    expect(run(mw, { user: { id: "1" } }).res.statusCode).toBe(403);
  });

  it("rejects when the specific action is not granted", () => {
    const { res, next } = run(mw, { user: { id: "1", permissions: perms(true, false) } });
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an unknown module", () => {
    expect(run(mw, { user: { id: "1", permissions: {} } }).res.statusCode).toBe(403);
  });

  it("allows when the action is granted", () => {
    const { next } = run(mw, { user: { id: "1", permissions: perms(true, true) } });
    expect(next).toHaveBeenCalled();
  });
});
