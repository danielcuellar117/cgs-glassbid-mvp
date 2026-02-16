import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { execSync } from "child_process";
import os from "os";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/", async (_req, reply) => {
    let dbOk = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      /* db unreachable */
    }

    // Disk usage (Linux only; safe fallback)
    let diskUsagePct: number | null = null;
    try {
      const output = execSync("df --output=pcent / | tail -1", {
        encoding: "utf-8",
      });
      diskUsagePct = parseInt(output.trim().replace("%", ""), 10);
    } catch {
      /* non-Linux or df unavailable */
    }

    // Worker heartbeat
    let workerStatus: unknown = null;
    try {
      const heartbeat = await prisma.workerHeartbeat.findFirst({
        orderBy: { lastHeartbeatAt: "desc" },
      });
      workerStatus = heartbeat;
    } catch {
      /* table may not exist yet */
    }

    const healthy = dbOk;
    const status = {
      status: healthy ? "ok" : "degraded",
      db: dbOk ? "connected" : "unreachable",
      diskUsagePct,
      workerStatus,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      hostname: os.hostname(),
    };

    return reply.status(healthy ? 200 : 503).send(status);
  });
}
