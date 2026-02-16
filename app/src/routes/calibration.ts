import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

/**
 * Calibration and measurement endpoints for the PNG-based measurement UI.
 *
 * Calibration: user clicks two points on a known dimension, enters real-world value.
 * Measurement: user clicks two endpoints, system computes using calibration.
 */
export async function calibrationRoutes(app: FastifyInstance) {
  // Save calibration for a page
  app.post<{
    Body: {
      jobId: string;
      pageNum: number;
      knownDimension: number; // Real-world value in inches
      pixelLength: number;    // Distance in pixels between the two points
      point1: { x: number; y: number };
      point2: { x: number; y: number };
      dpi: number;            // DPI at which the PNG was rendered
    };
  }>("/save", async (req, reply) => {
    const { jobId, pageNum, knownDimension, pixelLength, point1, point2, dpi } = req.body;

    if (!jobId || pageNum === undefined || !knownDimension || !pixelLength) {
      return reply.badRequest("jobId, pageNum, knownDimension, and pixelLength are required");
    }

    // Compute scale factor: real inches per pixel
    const scaleFactor = knownDimension / pixelLength;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { ssot: true },
    });
    if (!job) return reply.notFound("Job not found");

    const ssot = job.ssot as any;

    // Store calibration in SSOT per page
    if (!ssot.calibrations) {
      ssot.calibrations = {};
    }
    ssot.calibrations[String(pageNum)] = {
      knownDimension,
      pixelLength,
      scaleFactor,
      point1,
      point2,
      dpi,
      createdAt: new Date().toISOString(),
    };

    await prisma.job.update({
      where: { id: jobId },
      data: { ssot: ssot as any },
    });

    await prisma.auditLog.create({
      data: {
        jobId,
        actor: "user",
        action: "CALIBRATION_SAVED",
        diffJson: {
          pageNum,
          knownDimension,
          pixelLength,
          scaleFactor,
        } as any,
      },
    });

    return reply.send({
      pageNum,
      scaleFactor,
      unitPerPixel: `${scaleFactor.toFixed(4)} inches/pixel`,
    });
  });

  // Get calibration for a page
  app.get<{ Querystring: { jobId: string; pageNum: string } }>(
    "/",
    async (req, reply) => {
      const { jobId, pageNum } = req.query;
      if (!jobId || pageNum === undefined) {
        return reply.badRequest("jobId and pageNum are required");
      }

      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { ssot: true },
      });
      if (!job) return reply.notFound("Job not found");

      const ssot = job.ssot as any;
      const calibration = ssot?.calibrations?.[String(pageNum)];

      if (!calibration) {
        return reply.send({ calibrated: false });
      }

      return reply.send({ calibrated: true, ...calibration });
    },
  );

  // Submit a measurement (computed from calibration + pixel coordinates)
  app.post<{
    Body: {
      taskId: string;
      point1: { x: number; y: number };
      point2: { x: number; y: number };
      pixelDistance: number;
      computedValue: number; // The client-computed dimension = pixelDistance * scaleFactor
      measuredBy?: string;
    };
  }>("/measure", async (req, reply) => {
    const { taskId, point1, point2, pixelDistance, computedValue, measuredBy } = req.body;

    if (!taskId || !computedValue) {
      return reply.badRequest("taskId and computedValue are required");
    }

    // Look up the task
    const task = await prisma.measurementTask.findUnique({
      where: { id: taskId },
    });
    if (!task) return reply.notFound("Measurement task not found");

    // Complete the task with the measured value
    const updated = await prisma.measurementTask.update({
      where: { id: taskId },
      data: {
        status: "COMPLETED",
        measuredValue: computedValue,
        measuredBy: measuredBy || "user",
        measuredAt: new Date(),
        calibrationJson: {
          point1,
          point2,
          pixelDistance,
        } as any,
      },
    });

    // Update SSOT
    const job = await prisma.job.findUnique({
      where: { id: task.jobId },
      select: { ssot: true },
    });

    if (job) {
      const ssot = job.ssot as any;

      // Update measurement task in SSOT
      if (ssot?.measurementTasks) {
        const ssotTask = ssot.measurementTasks.find(
          (t: any) => t.taskId === taskId,
        );
        if (ssotTask) {
          ssotTask.status = "COMPLETED";
          ssotTask.measuredValue = computedValue;
          ssotTask.measuredBy = measuredBy || "user";
          ssotTask.measuredAt = new Date().toISOString();
          ssotTask.calibration = { point1, point2, pixelDistance };
        }
      }

      // Update item dimension
      if (ssot?.items) {
        const item = ssot.items.find(
          (i: any) => i.itemId === task.itemId,
        );
        if (item && item.dimensions?.[task.dimensionKey]) {
          item.dimensions[task.dimensionKey].value = computedValue;
          item.dimensions[task.dimensionKey].source = "MEASURED";
          item.dimensions[task.dimensionKey].confidence = 0.95;
        }
      }

      await prisma.job.update({
        where: { id: task.jobId },
        data: { ssot: ssot as any },
      });
    }

    // Audit
    await prisma.auditLog.create({
      data: {
        jobId: task.jobId,
        actor: measuredBy || "user",
        action: "MEASUREMENT_COMPLETED",
        diffJson: {
          taskId,
          dimensionKey: task.dimensionKey,
          computedValue,
          pixelDistance,
          point1,
          point2,
        } as any,
      },
    });

    return reply.send(updated);
  });

  // Request re-render at higher DPI (for measurement precision)
  app.post<{
    Body: {
      jobId: string;
      pageNum: number;
      dpi?: number;
    };
  }>("/re-render", async (req, reply) => {
    const { jobId, pageNum, dpi } = req.body;

    if (!jobId || pageNum === undefined) {
      return reply.badRequest("jobId and pageNum are required");
    }

    const requestedDpi = Math.min(dpi || 300, 400); // Max DPI = 400

    // Check rate limit: 1 re-render per page per minute
    const recentRequest = await prisma.renderRequest.findFirst({
      where: {
        jobId,
        pageNum,
        kind: "MEASURE",
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
    });

    if (recentRequest) {
      return reply.tooManyRequests(
        "Re-render rate limit: 1 per page per minute",
      );
    }

    // Delete the existing MEASURE render request (if any) so a new one can be created
    await prisma.renderRequest.deleteMany({
      where: {
        jobId,
        pageNum,
        kind: "MEASURE",
      },
    });

    // Create new render request at higher DPI
    const renderReq = await prisma.renderRequest.create({
      data: {
        jobId,
        pageNum,
        kind: "MEASURE",
        dpi: requestedDpi,
        status: "PENDING",
      },
    });

    return reply.status(201).send(renderReq);
  });
}
