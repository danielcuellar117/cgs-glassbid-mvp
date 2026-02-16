import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { presignedGetUrl, BUCKETS } from "../lib/minio.js";

export async function downloadRoutes(app: FastifyInstance) {
  // Get download URLs for job outputs
  app.get<{ Params: { jobId: string } }>(
    "/:jobId/outputs",
    async (req, reply) => {
      const job = await prisma.job.findUnique({
        where: { id: req.params.jobId },
        select: { ssot: true, status: true },
      });

      if (!job) return reply.notFound("Job not found");

      const ssot = job.ssot as any;
      const outputs = ssot?.outputs || [];

      if (outputs.length === 0) {
        return reply.send({ outputs: [], message: "No outputs generated yet" });
      }

      // Generate presigned URLs for each output
      const outputsWithUrls = await Promise.all(
        outputs.map(async (output: any) => {
          let downloadUrl = null;
          try {
            downloadUrl = await presignedGetUrl(
              output.bucket,
              output.key,
              900, // 15 min expiry
            );
          } catch {
            /* object may not exist */
          }
          return { ...output, downloadUrl };
        }),
      );

      return reply.send({ outputs: outputsWithUrls });
    },
  );

  // Regenerate PDFs: revert job to PRICING state
  app.post<{ Params: { jobId: string } }>(
    "/:jobId/regenerate",
    async (req, reply) => {
      const job = await prisma.job.findUnique({
        where: { id: req.params.jobId },
      });

      if (!job) return reply.notFound("Job not found");
      if (job.status !== "DONE") {
        return reply.badRequest(`Job is in ${job.status}, expected DONE`);
      }

      await prisma.job.update({
        where: { id: req.params.jobId },
        data: { status: "PRICED" },
      });

      await prisma.auditLog.create({
        data: {
          jobId: req.params.jobId,
          actor: "user",
          action: "REGENERATE_REQUESTED",
        },
      });

      return reply.send({ status: "PRICED", message: "Job queued for regeneration" });
    },
  );
}
