import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../../../app/src/server.js";
import { prisma } from "../../../../app/src/lib/prisma.js";
import { getTestToken, authHeader } from "../../helpers.js";
import type { FastifyInstance } from "fastify";

const mockPrisma = vi.mocked(prisma);

describe("Calibration Routes", () => {
  let app: FastifyInstance;
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp({ logger: false });
    token = getTestToken(app);
  });

  // ── POST /api/calibration/save ───────────────────────────────

  describe("POST /api/calibration/save", () => {
    it("should save calibration and return scale factor", async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        ssot: { items: [], calibrations: {} },
      } as any);
      mockPrisma.job.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/calibration/save",
        payload: {
          jobId: "j1",
          pageNum: 3,
          knownDimension: 36,
          pixelLength: 200,
          point1: { x: 10, y: 20 },
          point2: { x: 210, y: 20 },
          dpi: 200,
        },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.pageNum).toBe(3);
      expect(body.scaleFactor).toBeCloseTo(0.18, 2);
    });

    it("should create calibrations object if not present in SSOT", async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        ssot: { items: [] },
      } as any);
      mockPrisma.job.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/calibration/save",
        payload: {
          jobId: "j1",
          pageNum: 1,
          knownDimension: 48,
          pixelLength: 300,
          point1: { x: 0, y: 0 },
          point2: { x: 300, y: 0 },
          dpi: 200,
        },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const updateCall = mockPrisma.job.update.mock.calls[0][0] as any;
      expect(updateCall.data.ssot.calibrations).toBeDefined();
      expect(updateCall.data.ssot.calibrations["1"]).toBeDefined();
    });

    it("should return 404 for non-existent job", async () => {
      mockPrisma.job.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/calibration/save",
        payload: {
          jobId: "missing",
          pageNum: 1,
          knownDimension: 36,
          pixelLength: 200,
          point1: { x: 0, y: 0 },
          point2: { x: 200, y: 0 },
          dpi: 200,
        },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(404);
    });

    it("should reject missing required fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/calibration/save",
        payload: { jobId: "j1" },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(400);
    });

    it("should create audit log entry", async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        ssot: { items: [] },
      } as any);
      mockPrisma.job.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await app.inject({
        method: "POST",
        url: "/api/calibration/save",
        payload: {
          jobId: "j1",
          pageNum: 1,
          knownDimension: 36,
          pixelLength: 200,
          point1: { x: 0, y: 0 },
          point2: { x: 200, y: 0 },
          dpi: 200,
        },
        headers: authHeader(token),
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "CALIBRATION_SAVED",
            jobId: "j1",
          }),
        }),
      );
    });
  });

  // ── GET /api/calibration ─────────────────────────────────────

  describe("GET /api/calibration", () => {
    it("should return calibration data for a calibrated page", async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        ssot: {
          calibrations: {
            "3": {
              knownDimension: 36,
              pixelLength: 200,
              scaleFactor: 0.18,
              point1: { x: 10, y: 20 },
              point2: { x: 210, y: 20 },
              dpi: 200,
            },
          },
        },
      } as any);

      const res = await app.inject({
        method: "GET",
        url: "/api/calibration?jobId=j1&pageNum=3",
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.calibrated).toBe(true);
      expect(body.scaleFactor).toBeCloseTo(0.18, 2);
    });

    it("should return calibrated: false for uncalibrated page", async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        ssot: { calibrations: {} },
      } as any);

      const res = await app.inject({
        method: "GET",
        url: "/api/calibration?jobId=j1&pageNum=5",
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.calibrated).toBe(false);
    });

    it("should return 404 for non-existent job", async () => {
      mockPrisma.job.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: "/api/calibration?jobId=missing&pageNum=1",
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── POST /api/calibration/measure ────────────────────────────

  describe("POST /api/calibration/measure", () => {
    it("should complete measurement task and update SSOT", async () => {
      const task = {
        id: "t1",
        jobId: "j1",
        itemId: "item-1",
        dimensionKey: "width",
        status: "PENDING",
      };
      mockPrisma.measurementTask.findUnique.mockResolvedValue(task as any);
      mockPrisma.measurementTask.update.mockResolvedValue({
        ...task,
        status: "COMPLETED",
        measuredValue: 36,
      } as any);
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

      const res = await app.inject({
        method: "POST",
        url: "/api/calibration/measure",
        payload: {
          taskId: "t1",
          point1: { x: 10, y: 20 },
          point2: { x: 210, y: 20 },
          pixelDistance: 200,
          computedValue: 36,
        },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe("COMPLETED");
    });

    it("should return 404 for non-existent task", async () => {
      mockPrisma.measurementTask.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/calibration/measure",
        payload: {
          taskId: "missing",
          point1: { x: 0, y: 0 },
          point2: { x: 100, y: 0 },
          pixelDistance: 100,
          computedValue: 24,
        },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(404);
    });

    it("should reject missing required fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/calibration/measure",
        payload: { taskId: "t1" },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /api/calibration/re-render ──────────────────────────

  describe("POST /api/calibration/re-render", () => {
    it("should create a new MEASURE render request", async () => {
      mockPrisma.renderRequest.findFirst.mockResolvedValue(null);
      mockPrisma.renderRequest.deleteMany.mockResolvedValue({ count: 0 } as any);
      mockPrisma.renderRequest.create.mockResolvedValue({
        id: "rr-new",
        jobId: "j1",
        pageNum: 3,
        kind: "MEASURE",
        dpi: 300,
        status: "PENDING",
      } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/calibration/re-render",
        payload: { jobId: "j1", pageNum: 3, dpi: 300 },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.dpi).toBe(300);
      expect(body.kind).toBe("MEASURE");
    });

    it("should cap DPI at 400", async () => {
      mockPrisma.renderRequest.findFirst.mockResolvedValue(null);
      mockPrisma.renderRequest.deleteMany.mockResolvedValue({ count: 0 } as any);
      mockPrisma.renderRequest.create.mockResolvedValue({
        id: "rr-new",
        dpi: 400,
        status: "PENDING",
      } as any);

      await app.inject({
        method: "POST",
        url: "/api/calibration/re-render",
        payload: { jobId: "j1", pageNum: 3, dpi: 600 },
        headers: authHeader(token),
      });

      expect(mockPrisma.renderRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dpi: 400 }),
        }),
      );
    });

    it("should enforce rate limit (1 per page per minute)", async () => {
      mockPrisma.renderRequest.findFirst.mockResolvedValue({
        id: "rr-recent",
        createdAt: new Date(),
      } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/calibration/re-render",
        payload: { jobId: "j1", pageNum: 3 },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(429);
    });

    it("should reject missing required fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/calibration/re-render",
        payload: { jobId: "j1" },
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
