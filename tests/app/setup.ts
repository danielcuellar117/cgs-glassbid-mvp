/**
 * Vitest global setup for app tests.
 * Mocks Prisma and MinIO so unit tests run without real services.
 */
import { vi } from "vitest";

// Mock Prisma client
vi.mock("../../app/src/lib/prisma.js", () => {
  return {
    prisma: {
      job: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      project: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      storageObject: {
        create: vi.fn(),
      },
      renderRequest: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      pricebookVersion: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      pricingRule: {
        findMany: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

// Mock MinIO client
vi.mock("../../app/src/lib/minio.js", () => {
  return {
    minioClient: {
      presignedGetObject: vi.fn().mockResolvedValue("https://minio.test/signed-url"),
    },
    BUCKETS: {
      RAW_UPLOADS: "raw-uploads",
      PAGE_CACHE: "page-cache",
      OUTPUTS: "outputs",
    },
    presignedGetUrl: vi.fn().mockResolvedValue("https://minio.test/signed-url"),
  };
});
