import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../../../app/src/server.js";
import { prisma } from "../../../../app/src/lib/prisma.js";
import {
  MOCK_ADMIN_USER,
  MOCK_OPERATOR_USER,
  getAdminToken,
  getOperatorToken,
  authHeader,
} from "../../helpers.js";
import type { FastifyInstance } from "fastify";

const mockPrisma = vi.mocked(prisma);

describe("Admin User Routes", () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp({ logger: false });
    adminToken = getAdminToken(app);
  });

  // ── Authorization ────────────────────────────────────────────

  describe("Authorization", () => {
    it("should reject OPERATOR role with 403", async () => {
      const operatorToken = getOperatorToken(app);

      const res = await app.inject({
        method: "GET",
        url: "/api/admin/users",
        headers: authHeader(operatorToken),
      });

      expect(res.statusCode).toBe(403);
    });

    it("should reject unauthenticated request with 401", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/admin/users",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /api/admin/users ─────────────────────────────────────

  describe("GET /api/admin/users", () => {
    it("should list users for admin", async () => {
      const mockUsers = [
        { ...MOCK_ADMIN_USER },
        { ...MOCK_OPERATOR_USER },
      ];
      mockPrisma.user.findMany.mockResolvedValue(mockUsers as any);
      mockPrisma.user.count.mockResolvedValue(2);

      const res = await app.inject({
        method: "GET",
        url: "/api/admin/users",
        headers: authHeader(adminToken),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.users).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.page).toBe(1);
    });

    it("should support search query", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await app.inject({
        method: "GET",
        url: "/api/admin/users?search=admin",
        headers: authHeader(adminToken),
      });

      const call = mockPrisma.user.findMany.mock.calls[0][0] as any;
      expect(call.where.OR).toBeDefined();
      expect(call.where.OR[0].name.contains).toBe("admin");
    });

    it("should support pagination", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await app.inject({
        method: "GET",
        url: "/api/admin/users?page=2&limit=10",
        headers: authHeader(adminToken),
      });

      const call = mockPrisma.user.findMany.mock.calls[0][0] as any;
      expect(call.skip).toBe(10);
      expect(call.take).toBe(10);
    });
  });

  // ── GET /api/admin/users/:id ─────────────────────────────────

  describe("GET /api/admin/users/:id", () => {
    it("should return a single user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_ADMIN_USER as any);

      const res = await app.inject({
        method: "GET",
        url: "/api/admin/users/admin-user-id",
        headers: authHeader(adminToken),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.email).toBe("admin@test.com");
    });

    it("should return 404 for non-existent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: "/api/admin/users/missing",
        headers: authHeader(adminToken),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── POST /api/admin/users ────────────────────────────────────

  describe("POST /api/admin/users", () => {
    it("should create a new user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: "new-user-id",
        email: "new@test.com",
        name: "New User",
        role: "OPERATOR",
        tenantId: "default",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/admin/users",
        payload: { email: "new@test.com", name: "New User", password: "pass123" },
        headers: authHeader(adminToken),
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.email).toBe("new@test.com");
      expect(body.role).toBe("OPERATOR");
    });

    it("should reject duplicate email", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_ADMIN_USER as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/admin/users",
        payload: { email: "admin@test.com", name: "Dupe" },
        headers: authHeader(adminToken),
      });

      expect(res.statusCode).toBe(409);
    });

    it("should reject missing email", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/users",
        payload: { name: "No Email" },
        headers: authHeader(adminToken),
      });

      expect(res.statusCode).toBe(400);
    });

    it("should reject missing name", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/users",
        payload: { email: "test@test.com" },
        headers: authHeader(adminToken),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── PATCH /api/admin/users/:id ───────────────────────────────

  describe("PATCH /api/admin/users/:id", () => {
    it("should update user fields", async () => {
      mockPrisma.user.update.mockResolvedValue({
        ...MOCK_OPERATOR_USER,
        name: "Updated Name",
      } as any);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/admin/users/operator-user-id",
        payload: { name: "Updated Name" },
        headers: authHeader(adminToken),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).name).toBe("Updated Name");
    });

    it("should update user role", async () => {
      mockPrisma.user.update.mockResolvedValue({
        ...MOCK_OPERATOR_USER,
        role: "ADMIN",
      } as any);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/admin/users/operator-user-id",
        payload: { role: "ADMIN" },
        headers: authHeader(adminToken),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).role).toBe("ADMIN");
    });

    it("should return 404 for non-existent user", async () => {
      mockPrisma.user.update.mockRejectedValue(new Error("Record not found"));

      const res = await app.inject({
        method: "PATCH",
        url: "/api/admin/users/missing",
        payload: { name: "test" },
        headers: authHeader(adminToken),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── DELETE /api/admin/users/:id ──────────────────────────────

  describe("DELETE /api/admin/users/:id", () => {
    it("should soft-delete (deactivate) user and return 204", async () => {
      mockPrisma.user.update.mockResolvedValue({
        ...MOCK_OPERATOR_USER,
        isActive: false,
      } as any);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/admin/users/operator-user-id",
        headers: authHeader(adminToken),
      });

      expect(res.statusCode).toBe(204);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "operator-user-id" },
          data: { isActive: false },
        }),
      );
    });

    it("should return 404 for non-existent user", async () => {
      mockPrisma.user.update.mockRejectedValue(new Error("Record not found"));

      const res = await app.inject({
        method: "DELETE",
        url: "/api/admin/users/missing",
        headers: authHeader(adminToken),
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
