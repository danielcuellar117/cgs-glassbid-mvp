import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../../../app/src/server.js";
import { prisma } from "../../../../app/src/lib/prisma.js";
import {
  MOCK_ADMIN_USER,
  MOCK_GOOGLE_USER,
  getTestToken,
  getRefreshToken,
  authHeader,
} from "../../helpers.js";
import type { FastifyInstance } from "fastify";

const mockPrisma = vi.mocked(prisma);

describe("Auth Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp({ logger: false });
  });

  // ── POST /api/auth/login ─────────────────────────────────────

  describe("POST /api/auth/login", () => {
    it("should return access token and user on valid credentials", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_ADMIN_USER as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "admin@test.com", password: "admin123" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.accessToken).toBeDefined();
      expect(body.user.email).toBe("admin@test.com");
      expect(body.user.role).toBe("ADMIN");
      expect(body.user.passwordHash).toBeUndefined();
    });

    it("should set refresh token cookie", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_ADMIN_USER as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "admin@test.com", password: "admin123" },
      });

      expect(res.statusCode).toBe(200);
      const cookies = res.cookies;
      const refreshCookie = cookies.find((c: any) => c.name === "refresh_token");
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie!.httpOnly).toBe(true);
    });

    it("should reject wrong password", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_ADMIN_USER as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "admin@test.com", password: "wrongpassword" },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.payload).error).toContain("Invalid");
    });

    it("should reject non-existent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "nobody@test.com", password: "pass" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("should reject inactive user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...MOCK_ADMIN_USER,
        isActive: false,
      } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "admin@test.com", password: "admin123" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("should reject Google-only user (no passwordHash)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_GOOGLE_USER as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "google@test.com", password: "anypass" },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.payload).error).toContain("Google sign-in");
    });

    it("should reject missing email or password", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "admin@test.com" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /api/auth/refresh ───────────────────────────────────

  describe("POST /api/auth/refresh", () => {
    it("should return new access token with valid refresh cookie", async () => {
      const refreshToken = getRefreshToken(app);
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_ADMIN_USER as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        cookies: { refresh_token: refreshToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.accessToken).toBeDefined();
      expect(body.user.email).toBe("admin@test.com");
    });

    it("should rotate refresh token (set new cookie)", async () => {
      const refreshToken = getRefreshToken(app);
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_ADMIN_USER as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        cookies: { refresh_token: refreshToken },
      });

      const cookies = res.cookies;
      const newRefresh = cookies.find((c: any) => c.name === "refresh_token");
      expect(newRefresh).toBeDefined();
    });

    it("should reject missing refresh cookie", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.payload).error).toContain("No refresh token");
    });

    it("should reject invalid refresh token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        cookies: { refresh_token: "invalid-jwt-garbage" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("should reject when using access token as refresh", async () => {
      const accessToken = getTestToken(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        cookies: { refresh_token: accessToken },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.payload).error).toContain("Invalid token type");
    });

    it("should reject if user is no longer active", async () => {
      const refreshToken = getRefreshToken(app);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...MOCK_ADMIN_USER,
        isActive: false,
      } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        cookies: { refresh_token: refreshToken },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ── POST /api/auth/logout ────────────────────────────────────

  describe("POST /api/auth/logout", () => {
    it("should clear refresh cookie and return 204", async () => {
      const token = getTestToken(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(204);
      const cookies = res.cookies;
      const refreshCookie = cookies.find((c: any) => c.name === "refresh_token");
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie!.value).toBe("");
    });
  });

  // ── GET /api/auth/me ─────────────────────────────────────────

  describe("GET /api/auth/me", () => {
    it("should return current user with valid token", async () => {
      const token = getTestToken(app);
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_ADMIN_USER as any);

      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.user.email).toBe("admin@test.com");
      expect(body.user.role).toBe("ADMIN");
    });

    it("should return 401 without token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
      });

      expect(res.statusCode).toBe(401);
    });

    it("should return 401 for inactive user", async () => {
      const token = getTestToken(app);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...MOCK_ADMIN_USER,
        isActive: false,
      } as any);

      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
