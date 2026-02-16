import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../../../app/src/server.js";
import { prisma } from "../../../../app/src/lib/prisma.js";
import { presignedGetUrl } from "../../../../app/src/lib/minio.js";
import type { FastifyInstance } from "fastify";

const mockPrisma = vi.mocked(prisma);
const mockPresigned = vi.mocked(presignedGetUrl);

describe("Render Request Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp({ logger: false });
  });

  describe("POST /api/render-requests", () => {
    it("should reject request with missing fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/render-requests",
        payload: { jobId: "j1" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("should deduplicate: return existing non-failed request", async () => {
      const existing = {
        id: "rr-1",
        jobId: "j1",
        pageNum: 5,
        kind: "THUMB",
        dpi: 72,
        status: "PENDING",
        outputKey: null,
      };
      mockPrisma.renderRequest.findFirst.mockResolvedValue(existing as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/render-requests",
        payload: { jobId: "j1", pageNum: 5, kind: "THUMB" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).id).toBe("rr-1");
      expect(mockPrisma.renderRequest.create).not.toHaveBeenCalled();
    });

    it("should return presigned URL for DONE requests during dedup", async () => {
      const existing = {
        id: "rr-1",
        jobId: "j1",
        pageNum: 5,
        kind: "THUMB",
        dpi: 72,
        status: "DONE",
        outputKey: "page-cache/j1/5-thumb.png",
      };
      mockPrisma.renderRequest.findFirst.mockResolvedValue(existing as any);
      mockPresigned.mockResolvedValue("https://minio.test/thumb.png");

      const res = await app.inject({
        method: "POST",
        url: "/api/render-requests",
        payload: { jobId: "j1", pageNum: 5, kind: "THUMB" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.downloadUrl).toBe("https://minio.test/thumb.png");
    });

    it("should create new render request with default DPI for THUMB", async () => {
      mockPrisma.renderRequest.findFirst.mockResolvedValue(null);
      mockPrisma.renderRequest.create.mockResolvedValue({
        id: "rr-new",
        jobId: "j1",
        pageNum: 3,
        kind: "THUMB",
        dpi: 72,
        status: "PENDING",
      } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/render-requests",
        payload: { jobId: "j1", pageNum: 3, kind: "THUMB" },
      });

      expect(res.statusCode).toBe(201);
      expect(mockPrisma.renderRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dpi: 72,
            status: "PENDING",
          }),
        }),
      );
    });

    it("should use 200 DPI default for MEASURE kind", async () => {
      mockPrisma.renderRequest.findFirst.mockResolvedValue(null);
      mockPrisma.renderRequest.create.mockResolvedValue({
        id: "rr-m",
        dpi: 200,
        status: "PENDING",
      } as any);

      await app.inject({
        method: "POST",
        url: "/api/render-requests",
        payload: { jobId: "j1", pageNum: 3, kind: "MEASURE" },
      });

      expect(mockPrisma.renderRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dpi: 200 }),
        }),
      );
    });
  });

  describe("GET /api/render-requests/:id", () => {
    it("should return 404 for unknown request", async () => {
      mockPrisma.renderRequest.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: "/api/render-requests/missing",
      });

      expect(res.statusCode).toBe(404);
    });

    it("should include presigned URL for DONE status", async () => {
      const rr = {
        id: "rr-1",
        status: "DONE",
        outputKey: "cache/page-5.png",
      };
      mockPrisma.renderRequest.findUnique.mockResolvedValue(rr as any);
      mockPresigned.mockResolvedValue("https://minio.test/page-5.png");

      const res = await app.inject({
        method: "GET",
        url: "/api/render-requests/rr-1",
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).downloadUrl).toBe("https://minio.test/page-5.png");
    });
  });

  describe("GET /api/render-requests?jobId=", () => {
    it("should require jobId query parameter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/render-requests",
      });

      expect(res.statusCode).toBe(400);
    });

    it("should return render requests ordered by pageNum", async () => {
      mockPrisma.renderRequest.findMany.mockResolvedValue([
        { id: "rr-1", pageNum: 1 },
        { id: "rr-2", pageNum: 5 },
      ] as any);

      const res = await app.inject({
        method: "GET",
        url: "/api/render-requests?jobId=j1",
      });

      expect(res.statusCode).toBe(200);
      expect(mockPrisma.renderRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jobId: "j1" },
          orderBy: { pageNum: "asc" },
        }),
      );
    });
  });
});
