import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../../../app/src/server.js";
import { prisma } from "../../../../app/src/lib/prisma.js";
import type { FastifyInstance } from "fastify";

const mockPrisma = vi.mocked(prisma);

describe("Health Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp({ logger: false });
  });

  // /health is a public route (no auth required)

  describe("GET /health", () => {
    it("should return 200 with status ok when DB is reachable", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
      mockPrisma.workerHeartbeat.findFirst.mockResolvedValue(null);

      const res = await app.inject({ method: "GET", url: "/health" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe("ok");
      expect(body.db).toBe("connected");
    });

    it("should return 503 with status degraded when DB is unreachable", async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error("ECONNREFUSED"));
      mockPrisma.workerHeartbeat.findFirst.mockResolvedValue(null);

      const res = await app.inject({ method: "GET", url: "/health" });

      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe("degraded");
      expect(body.db).toBe("unreachable");
    });

    it("should include expected response shape", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
      mockPrisma.workerHeartbeat.findFirst.mockResolvedValue({
        workerId: "worker-1",
        status: "IDLE",
        lastHeartbeatAt: new Date(),
      } as any);

      const res = await app.inject({ method: "GET", url: "/health" });

      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("db");
      expect(body).toHaveProperty("memoryUsage");
      expect(body).toHaveProperty("uptime");
      expect(body).toHaveProperty("hostname");
      expect(body.memoryUsage).toHaveProperty("rss");
      expect(body.memoryUsage).toHaveProperty("heapUsed");
    });

    it("should include worker heartbeat status when available", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
      mockPrisma.workerHeartbeat.findFirst.mockResolvedValue({
        workerId: "worker-1",
        status: "PROCESSING",
        lastHeartbeatAt: new Date(),
        currentJobId: "job-123",
      } as any);

      const res = await app.inject({ method: "GET", url: "/health" });

      const body = JSON.parse(res.payload);
      expect(body.workerStatus).toBeDefined();
      expect(body.workerStatus.workerId).toBe("worker-1");
    });
  });
});
