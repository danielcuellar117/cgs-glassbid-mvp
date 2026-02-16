import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../../../app/src/server.js";
import { prisma } from "../../../../app/src/lib/prisma.js";
import type { FastifyInstance } from "fastify";

const mockPrisma = vi.mocked(prisma);

describe("Webhook Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp({ logger: false });
  });

  describe("POST /api/webhooks/tus-pre-create", () => {
    const makePreCreateBody = (token: string) => ({
      Event: {
        Upload: {
          MetaData: { token },
        },
      },
    });

    it("should reject request with missing token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/webhooks/tus-pre-create",
        payload: { Event: { Upload: { MetaData: {} } } },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.payload).error).toContain("Missing upload token");
    });

    it("should reject invalid/consumed token", async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/webhooks/tus-pre-create",
        payload: makePreCreateBody("bad-token"),
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.payload).error).toContain("Invalid or expired");
    });

    it("should reject expired token", async () => {
      const expiredJob = {
        id: "j1",
        uploadToken: "tok-1",
        uploadTokenExp: new Date(Date.now() - 1000),
        status: "CREATED",
      };
      mockPrisma.job.findFirst.mockResolvedValue(expiredJob as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/webhooks/tus-pre-create",
        payload: makePreCreateBody("tok-1"),
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.payload).error).toContain("expired");
    });

    it("should accept valid token and transition to UPLOADING", async () => {
      const validJob = {
        id: "j1",
        uploadToken: "valid-tok",
        uploadTokenExp: new Date(Date.now() + 3600000),
        status: "CREATED",
      };
      mockPrisma.job.findFirst.mockResolvedValue(validJob as any);
      mockPrisma.job.update.mockResolvedValue({ ...validJob, status: "UPLOADING" } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/webhooks/tus-pre-create",
        payload: makePreCreateBody("valid-tok"),
      });

      expect(res.statusCode).toBe(200);
      expect(mockPrisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "j1" },
          data: { status: "UPLOADING" },
        }),
      );
    });
  });

  describe("POST /api/webhooks/tus-post-finish", () => {
    const makePostFinishBody = (token: string, uploadId = "upload-123", size = 5000000) => ({
      Event: {
        Upload: {
          ID: uploadId,
          Size: size,
          MetaData: { token },
        },
      },
    });

    it("should return 200 with warning when no token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/webhooks/tus-post-finish",
        payload: { Event: { Upload: { MetaData: {} } } },
      });

      expect(res.statusCode).toBe(200);
    });

    it("should return 200 with warning when no matching job", async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/webhooks/tus-post-finish",
        payload: makePostFinishBody("unknown-tok"),
      });

      expect(res.statusCode).toBe(200);
    });

    it("should register StorageObject and transition to UPLOADED", async () => {
      const job = { id: "j1", projectId: "p1", uploadToken: "tok", status: "UPLOADING" };
      mockPrisma.job.findFirst.mockResolvedValue(job as any);
      mockPrisma.storageObject.create.mockResolvedValue({} as any);
      mockPrisma.job.update.mockResolvedValue({} as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/webhooks/tus-post-finish",
        payload: makePostFinishBody("tok", "upload-abc", 8000000),
      });

      expect(res.statusCode).toBe(200);

      // StorageObject created with correct key format
      expect(mockPrisma.storageObject.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: "j1",
            bucket: "raw-uploads",
            key: "p1/j1/upload-abc",
          }),
        }),
      );

      // Job transitioned to UPLOADED, token cleared
      expect(mockPrisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "UPLOADED",
            uploadToken: null,
            uploadTokenExp: null,
          }),
        }),
      );
    });
  });

  describe("POST /api/webhooks/tus (generic dispatcher)", () => {
    it("should dispatch pre-create type", async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/webhooks/tus",
        payload: {
          Type: "pre-create",
          Event: { Upload: { MetaData: { token: "test" } } },
        },
      });

      // Will get 403 because token lookup fails, which proves dispatch worked
      expect(res.statusCode).toBe(403);
    });

    it("should return 200 for unknown hook types", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/webhooks/tus",
        payload: { Type: "unknown-event" },
      });

      expect(res.statusCode).toBe(200);
    });
  });
});
