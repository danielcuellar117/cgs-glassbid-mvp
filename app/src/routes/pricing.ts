import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function pricingRoutes(app: FastifyInstance) {
  // ─── Pricebook Versions ─────────────────────────────────────────

  // List all pricebook versions
  app.get("/pricebook", async (_req, reply) => {
    const versions = await prisma.pricebookVersion.findMany({
      orderBy: { version: "desc" },
      include: { rules: { where: { isActive: true } } },
    });
    return reply.send(versions);
  });

  // Create a new pricebook version (optionally copying rules from previous)
  app.post<{
    Body: {
      effectiveDate: string;
      notes?: string;
      copyFromVersionId?: string;
    };
  }>("/pricebook", async (req, reply) => {
    const { effectiveDate, notes, copyFromVersionId } = req.body;

    if (!effectiveDate) {
      return reply.badRequest("effectiveDate is required");
    }

    const version = await prisma.pricebookVersion.create({
      data: {
        effectiveDate: new Date(effectiveDate),
        notes: notes || "",
      },
    });

    // Copy rules from previous version if specified
    if (copyFromVersionId) {
      const sourceRules = await prisma.pricingRule.findMany({
        where: { pricebookVersionId: copyFromVersionId },
      });

      if (sourceRules.length > 0) {
        await prisma.pricingRule.createMany({
          data: sourceRules.map((r) => ({
            pricebookVersionId: version.id,
            name: r.name,
            category: r.category,
            formulaJson: r.formulaJson as any,
            appliesTo: r.appliesTo as any,
            isActive: r.isActive,
          })),
        });
      }
    }

    const created = await prisma.pricebookVersion.findUnique({
      where: { id: version.id },
      include: { rules: true },
    });

    return reply.status(201).send(created);
  });

  // ─── Pricing Rules ──────────────────────────────────────────────

  // List rules for a pricebook version
  app.get<{ Querystring: { pricebookVersionId: string } }>(
    "/rules",
    async (req, reply) => {
      if (!req.query.pricebookVersionId) {
        return reply.badRequest("pricebookVersionId query parameter is required");
      }
      const rules = await prisma.pricingRule.findMany({
        where: { pricebookVersionId: req.query.pricebookVersionId },
        orderBy: { name: "asc" },
      });
      return reply.send(rules);
    },
  );

  // Create a pricing rule
  app.post<{
    Body: {
      pricebookVersionId: string;
      name: string;
      category: string;
      formulaJson: Record<string, unknown>;
      appliesTo?: Record<string, unknown>;
    };
  }>("/rules", async (req, reply) => {
    const { pricebookVersionId, name, category, formulaJson, appliesTo } = req.body;

    if (!pricebookVersionId || !name || !category || !formulaJson) {
      return reply.badRequest(
        "pricebookVersionId, name, category, and formulaJson are required",
      );
    }

    const rule = await prisma.pricingRule.create({
      data: {
        pricebookVersionId,
        name,
        category,
        formulaJson: formulaJson as any,
        appliesTo: appliesTo as any || null,
      },
    });

    return reply.status(201).send(rule);
  });

  // Update a pricing rule
  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      category?: string;
      formulaJson?: Record<string, unknown>;
      appliesTo?: Record<string, unknown>;
      isActive?: boolean;
    };
  }>("/rules/:id", async (req, reply) => {
    const { name, category, formulaJson, appliesTo, isActive } = req.body;

    const rule = await prisma.pricingRule.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(formulaJson !== undefined && { formulaJson: formulaJson as any }),
        ...(appliesTo !== undefined && { appliesTo: appliesTo as any }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return reply.send(rule);
  });

  // Delete a pricing rule
  app.delete<{ Params: { id: string } }>(
    "/rules/:id",
    async (req, reply) => {
      await prisma.pricingRule.delete({ where: { id: req.params.id } });
      return reply.status(204).send();
    },
  );

  // ─── Manual Price Override ──────────────────────────────────────

  // Override a line item price in the SSOT
  app.post<{
    Body: {
      jobId: string;
      itemId: string;
      unitPrice: number;
      reason: string;
    };
  }>("/override", async (req, reply) => {
    const { jobId, itemId, unitPrice, reason } = req.body;

    if (!jobId || !itemId || unitPrice === undefined || !reason) {
      return reply.badRequest("jobId, itemId, unitPrice, and reason are required");
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { ssot: true },
    });
    if (!job) return reply.notFound("Job not found");

    const ssot = job.ssot as any;
    if (!ssot?.pricing?.lineItems) {
      return reply.badRequest("Job has no pricing data");
    }

    const lineItem = ssot.pricing.lineItems.find(
      (li: any) => li.itemId === itemId,
    );
    if (!lineItem) return reply.notFound("Line item not found");

    // Apply override
    lineItem.unitPrice = unitPrice;
    lineItem.totalPrice = unitPrice * (lineItem.quantity || 1);
    lineItem.manualOverride = true;
    lineItem.overrideReason = reason;

    // Recalculate totals
    const subtotal = ssot.pricing.lineItems.reduce(
      (sum: number, li: any) => sum + (li.totalPrice || 0),
      0,
    );
    ssot.pricing.subtotal = Math.round(subtotal * 100) / 100;
    ssot.pricing.total = Math.round((subtotal + (ssot.pricing.tax || 0)) * 100) / 100;

    await prisma.job.update({
      where: { id: jobId },
      data: { ssot: ssot as any },
    });

    await prisma.auditLog.create({
      data: {
        jobId,
        actor: "user",
        action: "PRICE_OVERRIDE",
        diffJson: { itemId, unitPrice, reason } as any,
      },
    });

    return reply.send(lineItem);
  });
}
