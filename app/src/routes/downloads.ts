import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { minioClient } from "../lib/minio.js";
import archiver from "archiver";

export async function downloadRoutes(app: FastifyInstance) {
  // Get download URLs for job outputs (returns proxy URLs, not MinIO presigned)
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

      // Return outputs with proxy download URLs (not MinIO presigned)
      const outputsWithUrls = outputs.map((output: any) => ({
        ...output,
        downloadUrl: `/api/downloads/${req.params.jobId}/file/${encodeURIComponent(output.outputId)}`,
      }));

      return reply.send({ outputs: outputsWithUrls });
    },
  );

  // Stream a specific output file to the client (proxy for MinIO)
  app.get<{ Params: { jobId: string; outputId: string } }>(
    "/:jobId/file/:outputId",
    async (req, reply) => {
      const job = await prisma.job.findUnique({
        where: { id: req.params.jobId },
        select: { ssot: true },
      });

      if (!job) return reply.notFound("Job not found");

      const ssot = job.ssot as any;
      const outputs = ssot?.outputs || [];
      const output = outputs.find((o: any) => o.outputId === req.params.outputId);

      if (!output) return reply.notFound("Output not found");

      try {
        const stream = await minioClient.getObject(output.bucket, output.key);
        const fileName = output.key.split("/").pop() || "download.pdf";
        reply.header("Content-Type", "application/pdf");
        reply.header("Content-Disposition", `attachment; filename="${fileName}"`);
        reply.header("Cache-Control", "public, max-age=3600");
        return reply.send(stream);
      } catch (err) {
        app.log.error({ err, bucket: output.bucket, key: output.key }, "Failed to stream output file");
        return reply.code(404).send({ error: "File not found in storage" });
      }
    },
  );

  // Download all outputs as a ZIP
  app.get<{ Params: { jobId: string } }>(
    "/:jobId/zip",
    async (req, reply) => {
      const job = await prisma.job.findUnique({
        where: { id: req.params.jobId },
        select: { ssot: true },
      });

      if (!job) return reply.notFound("Job not found");

      const ssot = job.ssot as any;
      const outputs = ssot?.outputs || [];

      if (outputs.length === 0) {
        return reply.code(404).send({ error: "No outputs to download" });
      }

      reply.header("Content-Type", "application/zip");
      reply.header("Content-Disposition", `attachment; filename="job-${req.params.jobId.slice(0, 8)}-outputs.zip"`);

      const archive = archiver("zip", { zlib: { level: 5 } });
      reply.raw.on("close", () => archive.abort());

      for (const output of outputs) {
        try {
          const stream = await minioClient.getObject(output.bucket, output.key);
          const fileName = output.key.split("/").pop() || `${output.type}.pdf`;
          archive.append(stream as any, { name: fileName });
        } catch (err) {
          app.log.warn({ err, key: output.key }, "Skipping output in ZIP");
        }
      }

      archive.pipe(reply.raw);
      archive.finalize();
      return reply;
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
      if (job.status !== "DONE" && job.status !== "PRICED") {
        return reply.badRequest(`Job is in ${job.status}, expected DONE or PRICED`);
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
