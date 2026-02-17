/**
 * Vitest global setup for app tests.
 * Mocks Prisma, MinIO, bcrypt, and google-auth-library so unit tests run without real services.
 */
import { vi } from "vitest";

// Set JWT_SECRET before any module loads
process.env.JWT_SECRET = "test-secret-32-characters-long!!";
process.env.NODE_ENV = "test";

// Mock Prisma client
vi.mock("../../app/src/lib/prisma.js", () => {
  return {
    prisma: {
      $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
      job: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      project: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      storageObject: {
        create: vi.fn(),
      },
      renderRequest: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      measurementTask: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
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
      workerHeartbeat: {
        findFirst: vi.fn(),
      },
    },
  };
});

// Mock MinIO client
vi.mock("../../app/src/lib/minio.js", () => {
  return {
    minioClient: {
      presignedGetObject: vi.fn().mockResolvedValue("https://minio.test/signed-url"),
      getObject: vi.fn(),
    },
    BUCKETS: {
      RAW_UPLOADS: "raw-uploads",
      PAGE_CACHE: "page-cache",
      OUTPUTS: "outputs",
    },
    presignedGetUrl: vi.fn().mockResolvedValue("https://minio.test/signed-url"),
  };
});

// bcrypt is NOT mocked — real bcrypt.compare and bcrypt.hash run in tests.
// MOCK_ADMIN_USER in helpers.ts contains a real bcrypt hash for "admin123".

// Mock google-auth-library
vi.mock("google-auth-library", () => {
  return {
    OAuth2Client: vi.fn().mockImplementation(() => ({
      verifyIdToken: vi.fn().mockResolvedValue({
        getPayload: () => ({
          email: "google@test.com",
          name: "Google User",
          sub: "google-sub-123",
        }),
      }),
      getToken: vi.fn().mockResolvedValue({
        tokens: { id_token: "mock-id-token" },
      }),
    })),
  };
});
