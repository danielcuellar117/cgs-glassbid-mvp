import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../../../app/src/server.js";
import { prisma } from "../../../../app/src/lib/prisma.js";
import type { FastifyInstance } from "fastify";

const mockPrisma = vi.mocked(prisma);

describe("Audit Log Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp({ logger: false });
  });

  describe("GET /api/audit-log", () => {
    it("should list audit log entries", async () => {
      const mockEntries = [
        { id: "a1", jobId: "j1", action: "MEASUREMENT_COMPLETED", actor: "user", timestamp: new Date() },
        { id: "a2", jobId: "j1", action: "REVIEW_SUBMITTED", actor: "user", timestamp: new Date() },
      ];
      mockPrisma.auditLog.findMany.mockResolvedValue(mockEntries as any);

      const res = await app.inject({ method: "GET", url: "/api/audit-log" });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toHaveLength(2);
    });

    it("should filter by jobId", async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await app.inject({
        method: "GET",
        url: "/api/audit-log?jobId=j1",
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jobId: "j1" },
        }),
      );
    });

    it("should apply default limit of 50", async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await app.inject({ method: "GET", url: "/api/audit-log" });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it("should respect custom limit and offset", async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await app.inject({
        method: "GET",
        url: "/api/audit-log?limit=20&offset=10",
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 10 }),
      );
    });

    it("should cap limit at 200", async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await app.inject({
        method: "GET",
        url: "/api/audit-log?limit=500",
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });

    it("should order by timestamp desc", async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await app.inject({ method: "GET", url: "/api/audit-log" });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { timestamp: "desc" },
        }),
      );
    });
  });
});
