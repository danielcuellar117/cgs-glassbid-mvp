import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { v4 as uuidv4 } from "uuid";

export async function jobRoutes(app: FastifyInstance) {
  // List jobs for a project
  app.get<{ Querystring: { projectId?: string } }>(
    "/",
    async (req, reply) => {
      const where = req.query.projectId
        ? { projectId: req.query.projectId }
        : {};
      const jobs = await prisma.job.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          projectId: true,
          status: true,
          errorMessage: true,
          errorCode: true,
          retryCount: true,
          stageProgress: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return reply.send(jobs);
    },
  );

  // Get job by ID (includes SSOT)
  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        measurementTasks: true,
        renderRequests: { orderBy: { pageNum: "asc" } },
      },
    });
    if (!job) return reply.notFound("Job not found");
    return reply.send(job);
  });

  // Create job (initiates upload flow)
  // Returns an upload token for tusd authentication
  app.post<{
    Body: { projectId: string; fileName?: string; fileSize?: number };
  }>("/", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const projectId = body.projectId as string;
    const fileName = (body.fileName || body.originalFileName) as string | undefined;
    const fileSize = (body.fileSize || body.originalFileSize) as number | undefined;
    if (!projectId) return reply.badRequest("projectId is required");

    // Validate project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) return reply.notFound("Project not found");

    // Check per-job file size limit (10 GB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return reply.badRequest(
        `File size ${fileSize} exceeds maximum of ${MAX_FILE_SIZE} bytes`,
      );
    }

    // Generate upload token (2-hour expiry)
    const uploadToken = uuidv4();
    const uploadTokenExp = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const job = await prisma.job.create({
      data: {
        projectId,
        status: "CREATED",
        uploadToken,
        uploadTokenExp,
        ssot: {
          version: "1.0.0",
          tenantId: "default",
          projectId,
          metadata: {
            projectName: project.name,
            clientName: project.clientName,
            address: project.address,
            fileName: fileName || "unknown.pdf",
            fileSize: fileSize || 0,
          },
          pageIndex: [],
          units: [],
          items: [],
          assumptions: [],
          exclusions: [],
          alternates: [],
          pricing: { lineItems: [], subtotal: 0, tax: 0, total: 0 },
          measurementTasks: [],
          outputs: [],
        },
      },
    });

    const tusEndpoint = process.env.TUS_ENDPOINT || "http://localhost:8080/files/";

    return reply.status(201).send({
      id: job.id,
      jobId: job.id,
      uploadToken,
      tusEndpoint,
      uploadTokenExpiry: uploadTokenExp.toISOString(),
    });
  });

  // Get job SSOT
  app.get<{ Params: { id: string } }>("/:id/ssot", async (req, reply) => {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      select: { ssot: true },
    });
    if (!job) return reply.notFound("Job not found");
    return reply.send(job.ssot);
  });

  // Delete job and all related data (cascades to measurement_tasks, render_requests, storage_objects)
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true, lockedBy: true },
    });
    if (!job) return reply.notFound("Job not found");

    // Prevent deletion of jobs currently being processed
    if (job.lockedBy) {
      return reply.code(409).send({
        error: "Job is currently being processed by a worker. Try again later.",
      });
    }

    await prisma.job.delete({ where: { id: req.params.id } });

    app.log.info({ jobId: req.params.id }, "Job deleted");
    return reply.status(204).send();
  });

  // Update job SSOT (partial update via merge)
  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/:id/ssot",
    async (req, reply) => {
      const job = await prisma.job.findUnique({
        where: { id: req.params.id },
        select: { ssot: true },
      });
      if (!job) return reply.notFound("Job not found");

      const currentSsot =
        typeof job.ssot === "object" && job.ssot !== null ? job.ssot : {};
      const merged = { ...(currentSsot as Record<string, unknown>), ...req.body };

      const updated = await prisma.job.update({
        where: { id: req.params.id },
        data: { ssot: merged as any },
        select: { ssot: true },
      });

      return reply.send(updated.ssot);
    },
  );
}
