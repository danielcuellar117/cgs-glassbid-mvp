import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

/**
 * SSE endpoint for real-time job status updates.
 *
 * Polls the database every 2-3 seconds and pushes status changes
 * to the connected client. This is the simple polling-based approach
 * (Redis pub/sub can be added later for push-based SSE).
 */
export async function sseRoutes(app: FastifyInstance) {
  app.get<{ Params: { jobId: string } }>(
    "/jobs/:jobId",
    async (req, reply) => {
      const { jobId } = req.params;

      // Verify job exists
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { id: true },
      });
      if (!job) return reply.notFound("Job not found");

      // Set SSE headers
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      let lastStatus = "";
      let lastProgress = "";
      const heartbeatMs = parseInt(
        process.env.SSE_HEARTBEAT_INTERVAL || "15000",
        10,
      );

      // Poll loop
      const pollInterval = setInterval(async () => {
        try {
          const current = await prisma.job.findUnique({
            where: { id: jobId },
            select: {
              status: true,
              stageProgress: true,
              errorMessage: true,
              errorCode: true,
              updatedAt: true,
            },
          });

          if (!current) {
            reply.raw.write(`event: error\ndata: {"error":"Job not found"}\n\n`);
            clearInterval(pollInterval);
            clearInterval(heartbeat);
            reply.raw.end();
            return;
          }

          const progressStr = JSON.stringify(current.stageProgress);
          const statusChanged = current.status !== lastStatus;
          const progressChanged = progressStr !== lastProgress;

          if (statusChanged || progressChanged) {
            lastStatus = current.status;
            lastProgress = progressStr;

            const data = JSON.stringify({
              jobId,
              status: current.status,
              stageProgress: current.stageProgress,
              errorMessage: current.errorMessage,
              errorCode: current.errorCode,
              updatedAt: current.updatedAt,
            });

            reply.raw.write(`event: status\ndata: ${data}\n\n`);
          }

          // Close connection when job is terminal
          if (current.status === "DONE" || current.status === "FAILED") {
            reply.raw.write(`event: complete\ndata: {"status":"${current.status}"}\n\n`);
            clearInterval(pollInterval);
            clearInterval(heartbeat);
            reply.raw.end();
          }
        } catch (err) {
          app.log.error({ err }, "SSE poll error");
        }
      }, 2500);

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        reply.raw.write(`:heartbeat\n\n`);
      }, heartbeatMs);

      // Cleanup on client disconnect
      req.raw.on("close", () => {
        clearInterval(pollInterval);
        clearInterval(heartbeat);
      });
    },
  );
}
