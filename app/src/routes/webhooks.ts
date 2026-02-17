import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function webhookRoutes(app: FastifyInstance) {
  // tusd pre-create hook: validate upload token
  app.post("/tus-pre-create", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const event = body?.Event as Record<string, unknown> | undefined;
    const upload = event?.Upload as Record<string, unknown> | undefined;
    const metaData = upload?.MetaData as Record<string, string> | undefined;
    const token = metaData?.token;

    if (!token) {
      return reply.status(403).send({ error: "Missing upload token" });
    }

    // Find job with this token
    const job = await prisma.job.findFirst({
      where: {
        uploadToken: token,
        status: "CREATED",
      },
    });

    if (!job) {
      return reply.status(403).send({ error: "Invalid or expired upload token" });
    }

    // Check token expiry
    if (job.uploadTokenExp && new Date() > job.uploadTokenExp) {
      return reply.status(403).send({ error: "Upload token expired" });
    }

    // Update job status to UPLOADING
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "UPLOADING" },
    });

    return reply.status(200).send({});
  });

  // tusd post-finish hook: upload complete
  app.post("/tus-post-finish", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const event = body?.Event as Record<string, unknown> | undefined;
    const upload = event?.Upload as Record<string, unknown> | undefined;
    const metaData = upload?.MetaData as Record<string, string> | undefined;
    const token = metaData?.token;
    const uploadId = upload?.ID as string | undefined;
    const uploadSize = upload?.Size as number | undefined;
    const storageInfo = upload?.Storage as Record<string, string> | undefined;

    if (!token) {
      app.log.warn("tus-post-finish: no token in metadata");
      return reply.status(200).send({});
    }

    const job = await prisma.job.findFirst({
      where: {
        uploadToken: token,
        status: { in: ["CREATED", "UPLOADING"] },
      },
    });

    if (!job) {
      app.log.warn(`tus-post-finish: no job found for token`);
      return reply.status(200).send({});
    }

    // tusd S3 backend stores files using just the hash part of the ID (before the '+')
    // The Storage.Key field has the actual S3 key, or we extract the hash from the upload ID
    const s3Key = storageInfo?.Key || (uploadId ? uploadId.split("+")[0] : null) || "source.pdf";

    app.log.info({ uploadId, s3Key, storageInfo }, "tus-post-finish: resolved S3 key");

    // Register storage object
    await prisma.storageObject.create({
      data: {
        jobId: job.id,
        bucket: "raw-uploads",
        key: s3Key,
        sizeBytes: uploadSize ? BigInt(uploadSize) : null,
        contentType: "application/pdf",
        ttlPolicy: "14d",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    // Mark job as UPLOADED -- worker will pick it up
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "UPLOADED",
        uploadToken: null, // Consumed
        uploadTokenExp: null,
      },
    });

    app.log.info({ jobId: job.id }, "Upload complete, job set to UPLOADED");
    return reply.status(200).send({});
  });

  // Generic tusd hook handler (routes to specific handlers)
  app.post("/tus", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const hookType = body?.Type as string | undefined;

    app.log.info({ hookType }, "Received tusd webhook");

    if (hookType === "pre-create") {
      // Delegate to pre-create handler
      return app.inject({
        method: "POST",
        url: "/api/webhooks/tus-pre-create",
        payload: body,
      }).then((res) => {
        reply.status(res.statusCode).send(res.json());
      });
    }

    if (hookType === "post-finish") {
      return app.inject({
        method: "POST",
        url: "/api/webhooks/tus-post-finish",
        payload: body,
      }).then((res) => {
        reply.status(res.statusCode).send(res.json());
      });
    }

    // Other hook types: acknowledge
    return reply.status(200).send({});
  });
}
