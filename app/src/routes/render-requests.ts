import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { presignedGetUrl, BUCKETS, minioClient } from "../lib/minio.js";

export async function renderRequestRoutes(app: FastifyInstance) {
  // Create a render request (on-demand thumbnail)
  app.post<{
    Body: {
      jobId: string;
      pageNum: number;
      kind: "THUMB" | "MEASURE";
      dpi?: number;
    };
  }>("/", async (req, reply) => {
    const { jobId, pageNum, kind, dpi } = req.body;
    if (!jobId || pageNum === undefined || !kind) {
      return reply.badRequest("jobId, pageNum, and kind are required");
    }

    const defaultDpi = kind === "THUMB" ? 72 : 200;

    // Deduplication: check if a non-failed request already exists
    const existing = await prisma.renderRequest.findFirst({
      where: {
        jobId,
        pageNum,
        kind,
        status: { not: "FAILED" },
      },
    });

    if (existing) {
      // If already done, return with presigned URL
      if (existing.status === "DONE" && existing.outputKey) {
        const url = await presignedGetUrl(BUCKETS.PAGE_CACHE, existing.outputKey);
        return reply.send({ ...existing, downloadUrl: url });
      }
      return reply.send(existing);
    }

    const renderReq = await prisma.renderRequest.create({
      data: {
        jobId,
        pageNum,
        kind,
        dpi: dpi || defaultDpi,
        status: "PENDING",
      },
    });

    return reply.status(201).send(renderReq);
  });

  // Get render request status
  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const renderReq = await prisma.renderRequest.findUnique({
      where: { id: req.params.id },
    });
    if (!renderReq) return reply.notFound("Render request not found");

    // If done, include presigned download URL
    if (renderReq.status === "DONE" && renderReq.outputKey) {
      const url = await presignedGetUrl(BUCKETS.PAGE_CACHE, renderReq.outputKey);
      return reply.send({ ...renderReq, downloadUrl: url });
    }

    return reply.send(renderReq);
  });

  // Stream rendered image directly to client (avoids MinIO presigned URL issues)
  app.get<{ Params: { id: string } }>(
    "/:id/image",
    async (req, reply) => {
      const renderReq = await prisma.renderRequest.findUnique({
        where: { id: req.params.id },
      });
      if (!renderReq) return reply.notFound("Render request not found");

      if (renderReq.status !== "DONE" || !renderReq.outputKey) {
        return reply.code(202).send({ status: renderReq.status, message: "Not ready yet" });
      }

      try {
        const stream = await minioClient.getObject(
          BUCKETS.PAGE_CACHE,
          renderReq.outputKey,
        );
        const isJpeg = renderReq.outputKey.endsWith(".jpg");
        reply.header("Content-Type", isJpeg ? "image/jpeg" : "image/png");
        reply.header("Cache-Control", "public, max-age=86400");
        return reply.send(stream);
      } catch (err) {
        app.log.error({ err, key: renderReq.outputKey }, "Failed to stream render image");
        return reply.code(404).send({ error: "Image not found in storage" });
      }
    },
  );

  // List render requests for a job
  app.get<{ Querystring: { jobId: string } }>(
    "/",
    async (req, reply) => {
      if (!req.query.jobId) {
        return reply.badRequest("jobId query parameter is required when listing");
      }
      const requests = await prisma.renderRequest.findMany({
        where: { jobId: req.query.jobId },
        orderBy: { pageNum: "asc" },
      });
      return reply.send(requests);
    },
  );
}
