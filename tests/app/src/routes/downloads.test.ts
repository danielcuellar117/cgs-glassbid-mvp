import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../../../app/src/server.js";
import { prisma } from "../../../../app/src/lib/prisma.js";
import { presignedGetUrl } from "../../../../app/src/lib/minio.js";
import type { FastifyInstance } from "fastify";

const mockPrisma = vi.mocked(prisma);
const mockPresigned = vi.mocked(presignedGetUrl);

describe("Download Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp({ logger: false });
  });

  describe("GET /api/downloads/:jobId/outputs", () => {
    it("should return 404 for unknown job", async () => {
      mockPrisma.job.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: "/api/downloads/missing/outputs",
      });

      expect(res.statusCode).toBe(404);
    });

    it("should return empty array when no outputs exist", async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        ssot: { outputs: [] },
        status: "DONE",
      } as any);

      const res = await app.inject({
        method: "GET",
        url: "/api/downloads/j1/outputs",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.outputs).toEqual([]);
    });

    it("should generate presigned URLs for each output", async () => {
      const outputs = [
        { bucket: "outputs", key: "bid.pdf", type: "BID" },
        { bucket: "outputs", key: "shop.pdf", type: "SHOP_DRAWINGS" },
      ];
      mockPrisma.job.findUnique.mockResolvedValue({
        ssot: { outputs },
        status: "DONE",
      } as any);
      mockPresigned.mockResolvedValue("https://minio.test/signed");

      const res = await app.inject({
        method: "GET",
        url: "/api/downloads/j1/outputs",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.outputs).toHaveLength(2);
      expect(body.outputs[0].downloadUrl).toBe("https://minio.test/signed");
      expect(mockPresigned).toHaveBeenCalledTimes(2);
      expect(mockPresigned).toHaveBeenCalledWith("outputs", "bid.pdf", 900);
    });
  });

  describe("POST /api/downloads/:jobId/regenerate", () => {
    it("should return 404 for unknown job", async () => {
      mockPrisma.job.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/downloads/missing/regenerate",
      });

      expect(res.statusCode).toBe(404);
    });

    it("should reject regeneration if job is not DONE", async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        id: "j1",
        status: "PRICING",
      } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/downloads/j1/regenerate",
      });

      expect(res.statusCode).toBe(400);
      expect(res.payload).toContain("PRICING");
      expect(res.payload).toContain("expected DONE");
    });

    it("should revert DONE job to PRICED and create audit log", async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        id: "j1",
        status: "DONE",
      } as any);
      mockPrisma.job.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/downloads/j1/regenerate",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe("PRICED");

      expect(mockPrisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "PRICED" },
        }),
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "REGENERATE_REQUESTED",
          }),
        }),
      );
    });
  });
});
