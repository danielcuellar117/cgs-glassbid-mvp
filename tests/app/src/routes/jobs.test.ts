import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../../../app/src/server.js";
import { prisma } from "../../../../app/src/lib/prisma.js";
import type { FastifyInstance } from "fastify";

const mockPrisma = vi.mocked(prisma);

describe("Job Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp({ logger: false });
  });

  describe("GET /api/jobs", () => {
    it("should list all jobs", async () => {
      const mockJobs = [
        { id: "job-1", projectId: "p1", status: "CREATED", createdAt: new Date() },
        { id: "job-2", projectId: "p1", status: "DONE", createdAt: new Date() },
      ];
      mockPrisma.job.findMany.mockResolvedValue(mockJobs as any);

      const res = await app.inject({ method: "GET", url: "/api/jobs" });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toHaveLength(2);
      expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, orderBy: { createdAt: "desc" } }),
      );
    });

    it("should filter jobs by projectId", async () => {
      mockPrisma.job.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: "/api/jobs?projectId=proj-123",
      });

      expect(res.statusCode).toBe(200);
      expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: "proj-123" },
        }),
      );
    });
  });

  describe("GET /api/jobs/:id", () => {
    it("should return job with measurement tasks and render requests", async () => {
      const mockJob = {
        id: "job-1",
        status: "DONE",
        ssot: {},
        measurementTasks: [],
        renderRequests: [],
      };
      mockPrisma.job.findUnique.mockResolvedValue(mockJob as any);

      const res = await app.inject({ method: "GET", url: "/api/jobs/job-1" });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).id).toBe("job-1");
    });

    it("should return 404 for non-existent job", async () => {
      mockPrisma.job.findUnique.mockResolvedValue(null);

      const res = await app.inject({ method: "GET", url: "/api/jobs/nonexistent" });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /api/jobs", () => {
    it("should create a job with upload token", async () => {
      const mockProject = { id: "proj-1", name: "Test Project", clientName: "Client", address: "123 St" };
      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.job.create.mockResolvedValue({
        id: "new-job-id",
        projectId: "proj-1",
        status: "CREATED",
        uploadToken: "mock-uuid",
      } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/jobs",
        payload: { projectId: "proj-1", fileName: "plans.pdf", fileSize: 1000 },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.jobId).toBe("new-job-id");
      expect(body.uploadToken).toBeDefined();
      expect(body.tusEndpoint).toBeDefined();
    });

    it("should reject missing projectId", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/jobs",
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it("should reject non-existent project", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/jobs",
        payload: { projectId: "nonexistent" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("should reject file size exceeding 10GB", async () => {
      const mockProject = { id: "proj-1", name: "Test", clientName: "C", address: "" };
      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);

      const TEN_GB_PLUS_ONE = 10 * 1024 * 1024 * 1024 + 1;
      const res = await app.inject({
        method: "POST",
        url: "/api/jobs",
        payload: { projectId: "proj-1", fileSize: TEN_GB_PLUS_ONE },
      });

      expect(res.statusCode).toBe(400);
      expect(res.payload).toContain("exceeds maximum");
    });

    it("should initialize SSOT skeleton on creation", async () => {
      const mockProject = { id: "proj-1", name: "My Project", clientName: "Client Co", address: "456 Ave" };
      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.job.create.mockImplementation(async (args: any) => {
        return { id: "j1", ...args.data };
      });

      await app.inject({
        method: "POST",
        url: "/api/jobs",
        payload: { projectId: "proj-1", fileName: "plans.pdf" },
      });

      const createCall = mockPrisma.job.create.mock.calls[0][0] as any;
      const ssot = createCall.data.ssot;
      expect(ssot.version).toBe("1.0.0");
      expect(ssot.pageIndex).toEqual([]);
      expect(ssot.items).toEqual([]);
      expect(ssot.pricing.subtotal).toBe(0);
    });
  });

  describe("GET /api/jobs/:id/ssot", () => {
    it("should return SSOT JSON", async () => {
      const ssot = { version: "1.0.0", items: [] };
      mockPrisma.job.findUnique.mockResolvedValue({ ssot } as any);

      const res = await app.inject({ method: "GET", url: "/api/jobs/j1/ssot" });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual(ssot);
    });

    it("should return 404 for unknown job", async () => {
      mockPrisma.job.findUnique.mockResolvedValue(null);

      const res = await app.inject({ method: "GET", url: "/api/jobs/missing/ssot" });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PATCH /api/jobs/:id/ssot", () => {
    it("should merge patch into existing SSOT", async () => {
      const existing = { version: "1.0.0", items: [], extra: "keep" };
      mockPrisma.job.findUnique.mockResolvedValue({ ssot: existing } as any);
      mockPrisma.job.update.mockResolvedValue({ ssot: { ...existing, items: ["new"] } } as any);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/jobs/j1/ssot",
        payload: { items: ["new"] },
      });

      expect(res.statusCode).toBe(200);
      const updateCall = mockPrisma.job.update.mock.calls[0][0] as any;
      expect(updateCall.data.ssot.extra).toBe("keep");
      expect(updateCall.data.ssot.items).toEqual(["new"]);
    });
  });
});
