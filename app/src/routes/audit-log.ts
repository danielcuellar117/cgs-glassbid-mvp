import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function auditLogRoutes(app: FastifyInstance) {
  // GET /api/audit-log?jobId=&limit=&offset=
  app.get("/", async (req, reply) => {
    const { jobId, limit, offset } = req.query as {
      jobId?: string;
      limit?: string;
      offset?: string;
    };

    const take = Math.min(parseInt(limit || "50", 10), 200);
    const skip = parseInt(offset || "0", 10);

    const where: Record<string, unknown> = {};
    if (jobId) where.jobId = jobId;

    const entries = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    });

    return reply.send(entries);
  });
}
