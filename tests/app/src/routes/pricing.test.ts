import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../../../app/src/server.js";
import { prisma } from "../../../../app/src/lib/prisma.js";
import type { FastifyInstance } from "fastify";

const mockPrisma = vi.mocked(prisma);

describe("Pricing Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp({ logger: false });
  });

  describe("GET /api/pricing/pricebook", () => {
    it("should list pricebook versions", async () => {
      mockPrisma.pricebookVersion.findMany.mockResolvedValue([
        { id: "v1", version: 2, rules: [] },
        { id: "v0", version: 1, rules: [] },
      ] as any);

      const res = await app.inject({
        method: "GET",
        url: "/api/pricing/pricebook",
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toHaveLength(2);
    });
  });

  describe("POST /api/pricing/pricebook", () => {
    it("should reject missing effectiveDate", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/pricing/pricebook",
        payload: { notes: "test" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("should create pricebook version", async () => {
      mockPrisma.pricebookVersion.create.mockResolvedValue({ id: "v-new" } as any);
      mockPrisma.pricebookVersion.findUnique.mockResolvedValue({
        id: "v-new",
        version: 1,
        rules: [],
      } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/pricing/pricebook",
        payload: { effectiveDate: "2025-06-01" },
      });

      expect(res.statusCode).toBe(201);
    });

    it("should copy rules from previous version when copyFromVersionId provided", async () => {
      mockPrisma.pricebookVersion.create.mockResolvedValue({ id: "v-new" } as any);
      mockPrisma.pricingRule.findMany.mockResolvedValue([
        { name: "Rule 1", category: "SHOWER_ENCLOSURE", formulaJson: {}, appliesTo: null, isActive: true },
      ] as any);
      mockPrisma.pricingRule.createMany.mockResolvedValue({ count: 1 } as any);
      mockPrisma.pricebookVersion.findUnique.mockResolvedValue({
        id: "v-new",
        rules: [{ name: "Rule 1" }],
      } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/pricing/pricebook",
        payload: { effectiveDate: "2025-06-01", copyFromVersionId: "v-old" },
      });

      expect(res.statusCode).toBe(201);
      expect(mockPrisma.pricingRule.createMany).toHaveBeenCalled();
    });
  });

  describe("POST /api/pricing/rules", () => {
    it("should reject missing required fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/pricing/rules",
        payload: { name: "Rule1" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("should create a pricing rule", async () => {
      mockPrisma.pricingRule.create.mockResolvedValue({
        id: "rule-1",
        name: "Base shower",
        category: "SHOWER_ENCLOSURE",
      } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/pricing/rules",
        payload: {
          pricebookVersionId: "v1",
          name: "Base shower",
          category: "SHOWER_ENCLOSURE",
          formulaJson: { type: "per_sqft", rate: 45 },
        },
      });

      expect(res.statusCode).toBe(201);
    });
  });

  describe("POST /api/pricing/override", () => {
    it("should reject missing fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/pricing/override",
        payload: { jobId: "j1" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("should apply price override and recalculate totals", async () => {
      const ssot = {
        pricing: {
          lineItems: [
            { itemId: "item-1", unitPrice: 100, quantity: 10, totalPrice: 1000, manualOverride: false },
            { itemId: "item-2", unitPrice: 200, quantity: 5, totalPrice: 1000, manualOverride: false },
          ],
          subtotal: 2000,
          tax: 0,
          total: 2000,
        },
      };
      mockPrisma.job.findUnique.mockResolvedValue({ ssot } as any);
      mockPrisma.job.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/pricing/override",
        payload: {
          jobId: "j1",
          itemId: "item-1",
          unitPrice: 150,
          reason: "Customer negotiation",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.unitPrice).toBe(150);
      expect(body.totalPrice).toBe(1500);
      expect(body.manualOverride).toBe(true);

      // Check audit log was created
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "PRICE_OVERRIDE",
          }),
        }),
      );
    });
  });
});
