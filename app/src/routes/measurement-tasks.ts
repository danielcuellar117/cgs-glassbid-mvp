import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function measurementTaskRoutes(app: FastifyInstance) {
  // List measurement tasks for a job
  app.get<{ Querystring: { jobId: string } }>(
    "/",
    async (req, reply) => {
      if (!req.query.jobId) {
        return reply.badRequest("jobId query parameter is required");
      }
      const tasks = await prisma.measurementTask.findMany({
        where: { jobId: req.query.jobId },
        orderBy: [{ status: "asc" }, { pageNum: "asc" }],
      });
      return reply.send(tasks);
    },
  );

  // Get single measurement task
  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const task = await prisma.measurementTask.findUnique({
      where: { id: req.params.id },
    });
    if (!task) return reply.notFound("Measurement task not found");
    return reply.send(task);
  });

  // Complete a measurement task (submit measurement)
  app.patch<{
    Params: { id: string };
    Body: {
      measuredValue: number;
      measuredBy?: string;
      calibration?: Record<string, unknown>;
    };
  }>("/:id/complete", async (req, reply) => {
    const { measuredValue, measuredBy, calibration } = req.body;

    if (measuredValue === undefined || measuredValue === null) {
      return reply.badRequest("measuredValue is required");
    }

    const task = await prisma.measurementTask.findUnique({
      where: { id: req.params.id },
    });
    if (!task) return reply.notFound("Measurement task not found");

    const updated = await prisma.measurementTask.update({
      where: { id: req.params.id },
      data: {
        status: "COMPLETED",
        measuredValue,
        measuredBy: measuredBy || "user",
        measuredAt: new Date(),
        calibrationJson: (calibration as any) || undefined,
      },
    });

    // Also update the SSOT
    const job = await prisma.job.findUnique({
      where: { id: task.jobId },
      select: { ssot: true },
    });

    if (job) {
      const ssot = job.ssot as any;
      if (ssot?.measurementTasks) {
        const ssotTask = ssot.measurementTasks.find(
          (t: any) => t.taskId === req.params.id,
        );
        if (ssotTask) {
          ssotTask.status = "COMPLETED";
          ssotTask.measuredValue = measuredValue;
          ssotTask.measuredBy = measuredBy || "user";
          ssotTask.measuredAt = new Date().toISOString();
          ssotTask.calibration = calibration || null;
        }

        // Update the item dimension
        if (ssot?.items) {
          const item = ssot.items.find(
            (i: any) => i.itemId === task.itemId,
          );
          if (item && item.dimensions[task.dimensionKey]) {
            item.dimensions[task.dimensionKey].value = measuredValue;
            item.dimensions[task.dimensionKey].source = "MEASURED";
            item.dimensions[task.dimensionKey].confidence = 0.95;
          }
        }

        await prisma.job.update({
          where: { id: task.jobId },
          data: { ssot: ssot as any },
        });
      }
    }

    // Log the measurement in audit
    await prisma.auditLog.create({
      data: {
        jobId: task.jobId,
        actor: measuredBy || "user",
        action: "MEASUREMENT_COMPLETED",
        diffJson: {
          taskId: req.params.id,
          dimensionKey: task.dimensionKey,
          measuredValue,
        },
      },
    });

    return reply.send(updated);
  });

  // Skip a measurement task
  app.patch<{ Params: { id: string }; Body: { reason?: string } }>(
    "/:id/skip",
    async (req, reply) => {
      const task = await prisma.measurementTask.findUnique({
        where: { id: req.params.id },
      });
      if (!task) return reply.notFound("Measurement task not found");

      const updated = await prisma.measurementTask.update({
        where: { id: req.params.id },
        data: { status: "SKIPPED" },
      });

      // Update SSOT -- mark item as TO_BE_VERIFIED_IN_FIELD
      const job = await prisma.job.findUnique({
        where: { id: task.jobId },
        select: { ssot: true },
      });

      if (job) {
        const ssot = job.ssot as any;
        if (ssot?.items) {
          const item = ssot.items.find(
            (i: any) => i.itemId === task.itemId,
          );
          if (item) {
            const flags = item.flags || [];
            if (!flags.includes("TO_BE_VERIFIED_IN_FIELD")) {
              flags.push("TO_BE_VERIFIED_IN_FIELD");
            }
            // Remove NEEDS_REVIEW if all tasks for this item are done/skipped
            const itemTasks = ssot.measurementTasks?.filter(
              (t: any) => t.itemId === task.itemId,
            ) || [];
            const allResolved = itemTasks.every(
              (t: any) => t.status === "COMPLETED" || t.status === "SKIPPED" || t.taskId === req.params.id,
            );
            if (allResolved) {
              const idx = flags.indexOf("NEEDS_REVIEW");
              if (idx !== -1) flags.splice(idx, 1);
            }
            item.flags = flags;
          }
        }

        if (ssot?.measurementTasks) {
          const ssotTask = ssot.measurementTasks.find(
            (t: any) => t.taskId === req.params.id,
          );
          if (ssotTask) {
            ssotTask.status = "SKIPPED";
          }
        }

        await prisma.job.update({
          where: { id: task.jobId },
          data: { ssot: ssot as any },
        });
      }

      return reply.send(updated);
    },
  );

  // Submit review: mark all tasks as reviewed and advance job
  app.post<{ Body: { jobId: string } }>("/submit-review", async (req, reply) => {
    const { jobId } = req.body;
    if (!jobId) return reply.badRequest("jobId is required");

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return reply.notFound("Job not found");
    if (job.status !== "NEEDS_REVIEW") {
      return reply.badRequest(`Job is in ${job.status}, expected NEEDS_REVIEW`);
    }

    // Check all measurement tasks are resolved
    const pendingTasks = await prisma.measurementTask.findMany({
      where: { jobId, status: "PENDING" },
    });

    if (pendingTasks.length > 0) {
      return reply.badRequest(
        `${pendingTasks.length} measurement task(s) still pending`,
      );
    }

    // Update SSOT: remove NEEDS_REVIEW flags from items where all tasks resolved
    const ssot = job.ssot as any;
    if (ssot?.items) {
      for (const item of ssot.items) {
        const flags = item.flags || [];
        const idx = flags.indexOf("NEEDS_REVIEW");
        if (idx !== -1) {
          flags.splice(idx, 1);
        }
        item.flags = flags;
      }
    }

    // Transition to REVIEWED
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "REVIEWED",
        ssot: ssot as any,
      },
    });

    await prisma.auditLog.create({
      data: {
        jobId,
        actor: "user",
        action: "REVIEW_SUBMITTED",
        diffJson: { resolvedTasks: pendingTasks.length },
      },
    });

    return reply.send({ status: "REVIEWED", jobId });
  });
}
