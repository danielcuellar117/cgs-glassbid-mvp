import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../../../app/src/server.js";
import { prisma } from "../../../../app/src/lib/prisma.js";
import { getTestToken, authHeader } from "../../helpers.js";
import type { FastifyInstance } from "fastify";

const mockPrisma = vi.mocked(prisma);

describe("Measurement Task Routes", () => {
  let app: FastifyInstance;
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp({ logger: false });
    token = getTestToken(app);
  });

  describe("GET /api/measurement-tasks", () => {
    it("should list tasks for a given jobId", async () => {
      const mockTasks = [
        { id: "t1", jobId: "j1", status: "PENDING", pageNum: 1 },
        { id: "t2", jobId: "j1", status: "COMPLETED", pageNum: 2 },
      ];
      mockPrisma.measurementTask.findMany.mockResolvedValue(mockTasks as any);

      const res = await app.inject({
        method: "GET",
        url: "/api/measurement-tasks?jobId=j1",
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toHaveLength(2);
    });

    it("should reject request without jobId", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/measurement-tasks",
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /api/measurement-tasks/:id", () => {
    it("should return a single task", async () => {
      const mockTask = { id: "t1", jobId: "j1", status: "PENDING" };
      mockPrisma.measurementTask.findUnique.mockResolvedValue(mockTask as any);

      const res = await app.inject({
        method: "GET",
        url: "/api/measurement-tasks/t1",
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).id).toBe("t1");
    });

    it("should return 404 for missing task", async () => {
      mockPrisma.measurementTask.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: "/api/measurement-tasks/missing",
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PATCH /api/measurement-tasks/:id/complete", () => {
    it("should complete a task with measured value", async () => {
      const mockTask = {
        id: "t1",
        jobId: "j1",
        itemId: "item-1",
        dimensionKey: "width",
        status: "PENDING",
      };
      mockPrisma.measurementTask.findUnique.mockResolvedValue(mockTask as any);
      mockPrisma.measurementTask.update.mockResolvedValue({
        ...mockTask,
        status: "COMPLETED",
        measuredValue: 36.5,
      } as any);
      mockPrisma.job.findUnique.mockResolvedValue({
        ssot: { items: [], measurementTasks: [] },
      } as any);
      mockPrisma.job.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/measurement-tasks/t1/complete",
        payload: { measuredValue: 36.5, measuredBy: "operator" },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(mockPrisma.measurementTask.update).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it("should reject missing measuredValue", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/measurement-tasks/t1/complete",
        payload: {},
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(400);
    });

    it("should return 404 for non-existent task", async () => {
      mockPrisma.measurementTask.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/measurement-tasks/missing/complete",
        payload: { measuredValue: 10 },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(404);
    });

    it("should update SSOT with measured value", async () => {
      const mockTask = {
        id: "t1",
        jobId: "j1",
        itemId: "item-1",
        dimensionKey: "width",
      };
      mockPrisma.measurementTask.findUnique.mockResolvedValue(mockTask as any);
      mockPrisma.measurementTask.update.mockResolvedValue({ ...mockTask, status: "COMPLETED" } as any);
      mockPrisma.job.findUnique.mockResolvedValue({
        ssot: {
          items: [
            {
              itemId: "item-1",
              dimensions: { width: { value: null, source: "EXTRACTED", confidence: 0.5 } },
            },
          ],
          measurementTasks: [{ taskId: "t1", status: "PENDING" }],
        },
      } as any);
      mockPrisma.job.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await app.inject({
        method: "PATCH",
        url: "/api/measurement-tasks/t1/complete",
        payload: { measuredValue: 42 },
        headers: authHeader(token),
      });

      const updateCall = mockPrisma.job.update.mock.calls[0][0] as any;
      const item = updateCall.data.ssot.items[0];
      expect(item.dimensions.width.value).toBe(42);
      expect(item.dimensions.width.source).toBe("MEASURED");
      expect(item.dimensions.width.confidence).toBe(0.95);
    });
  });

  describe("PATCH /api/measurement-tasks/:id/skip", () => {
    it("should skip a task", async () => {
      const mockTask = { id: "t1", jobId: "j1", itemId: "item-1" };
      mockPrisma.measurementTask.findUnique.mockResolvedValue(mockTask as any);
      mockPrisma.measurementTask.update.mockResolvedValue({
        ...mockTask,
        status: "SKIPPED",
      } as any);
      mockPrisma.job.findUnique.mockResolvedValue({
        ssot: { items: [], measurementTasks: [] },
      } as any);
      mockPrisma.job.update.mockResolvedValue({} as any);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/measurement-tasks/t1/skip",
        payload: { reason: "Not needed" },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(mockPrisma.measurementTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "SKIPPED" },
        }),
      );
    });

    it("should return 404 for non-existent task", async () => {
      mockPrisma.measurementTask.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/measurement-tasks/missing/skip",
        payload: {},
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /api/measurement-tasks/skip-bulk", () => {
    it("should bulk skip pending tasks", async () => {
      const tasks = [
        { id: "t1", jobId: "j1", itemId: "i1", status: "PENDING" },
        { id: "t2", jobId: "j1", itemId: "i2", status: "PENDING" },
      ];
      mockPrisma.measurementTask.findMany.mockResolvedValue(tasks as any);
      mockPrisma.measurementTask.updateMany.mockResolvedValue({ count: 2 } as any);
      mockPrisma.job.findUnique.mockResolvedValue({
        ssot: { items: [], measurementTasks: [] },
      } as any);
      mockPrisma.job.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/measurement-tasks/skip-bulk",
        payload: { taskIds: ["t1", "t2"], reason: "Not relevant" },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.skipped).toBe(2);
      expect(body.reason).toBe("Not relevant");
    });

    it("should reject empty taskIds", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/measurement-tasks/skip-bulk",
        payload: { taskIds: [], reason: "test" },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(400);
    });

    it("should reject missing reason", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/measurement-tasks/skip-bulk",
        payload: { taskIds: ["t1"] },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(400);
    });

    it("should reject when no pending tasks found", async () => {
      mockPrisma.measurementTask.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: "POST",
        url: "/api/measurement-tasks/skip-bulk",
        payload: { taskIds: ["t1"], reason: "test" },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/measurement-tasks/submit-review", () => {
    it("should submit review when all tasks resolved", async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        id: "j1",
        status: "NEEDS_REVIEW",
        ssot: { items: [{ flags: ["NEEDS_REVIEW"] }] },
      } as any);
      mockPrisma.measurementTask.findMany.mockResolvedValue([]);
      mockPrisma.job.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/measurement-tasks/submit-review",
        payload: { jobId: "j1" },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe("REVIEWED");
    });

    it("should reject when job has pending tasks", async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        id: "j1",
        status: "NEEDS_REVIEW",
        ssot: {},
      } as any);
      mockPrisma.measurementTask.findMany.mockResolvedValue([
        { id: "t1", status: "PENDING" },
      ] as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/measurement-tasks/submit-review",
        payload: { jobId: "j1" },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(400);
      expect(res.payload).toContain("pending");
    });

    it("should reject when job is not in NEEDS_REVIEW state", async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        id: "j1",
        status: "DONE",
        ssot: {},
      } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/measurement-tasks/submit-review",
        payload: { jobId: "j1" },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(400);
    });

    it("should return 404 for non-existent job", async () => {
      mockPrisma.job.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/measurement-tasks/submit-review",
        payload: { jobId: "missing" },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(404);
    });

    it("should reject missing jobId", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/measurement-tasks/submit-review",
        payload: {},
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
