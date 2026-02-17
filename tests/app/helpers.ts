/**
 * Shared test helpers for app unit tests.
 * Provides JWT token generation and mock user objects.
 */
import type { FastifyInstance } from "fastify";

// Real bcrypt hash of "admin123" (cost 10)
const REAL_HASH = "$2b$10$3DEBQSiGthN7ngmvHWtTEuA8jSQ.NiC0ETK.hkL4xr9V.YpO7/eue";

export const MOCK_ADMIN_USER = {
  id: "admin-user-id",
  email: "admin@test.com",
  name: "Admin User",
  passwordHash: REAL_HASH,
  role: "ADMIN" as const,
  tenantId: "default",
  googleId: null,
  isActive: true,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

export const MOCK_OPERATOR_USER = {
  id: "operator-user-id",
  email: "operator@test.com",
  name: "Operator User",
  passwordHash: REAL_HASH,
  role: "OPERATOR" as const,
  tenantId: "default",
  googleId: null,
  isActive: true,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

export const MOCK_GOOGLE_USER = {
  id: "google-user-id",
  email: "google@test.com",
  name: "Google User",
  passwordHash: null,
  role: "OPERATOR" as const,
  tenantId: "default",
  googleId: "google-sub-123",
  isActive: true,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

/**
 * Generate a valid JWT access token for testing.
 * Uses the app's registered JWT instance so the token is verifiable.
 */
export function getTestToken(
  app: FastifyInstance,
  overrides: Record<string, unknown> = {},
): string {
  return app.jwt.sign(
    {
      sub: MOCK_ADMIN_USER.id,
      email: MOCK_ADMIN_USER.email,
      role: MOCK_ADMIN_USER.role,
      tenantId: MOCK_ADMIN_USER.tenantId,
      type: "access",
      ...overrides,
    },
    { expiresIn: "15m" },
  );
}

/** Generate a JWT access token with ADMIN role. */
export function getAdminToken(app: FastifyInstance): string {
  return getTestToken(app, {
    sub: MOCK_ADMIN_USER.id,
    email: MOCK_ADMIN_USER.email,
    role: "ADMIN",
  });
}

/** Generate a JWT access token with OPERATOR role. */
export function getOperatorToken(app: FastifyInstance): string {
  return getTestToken(app, {
    sub: MOCK_OPERATOR_USER.id,
    email: MOCK_OPERATOR_USER.email,
    role: "OPERATOR",
  });
}

/** Generate a JWT refresh token for testing. */
export function getRefreshToken(
  app: FastifyInstance,
  overrides: Record<string, unknown> = {},
): string {
  return app.jwt.sign(
    {
      sub: MOCK_ADMIN_USER.id,
      email: MOCK_ADMIN_USER.email,
      role: MOCK_ADMIN_USER.role,
      tenantId: MOCK_ADMIN_USER.tenantId,
      type: "refresh",
      ...overrides,
    },
    { expiresIn: "7d" },
  );
}

/** Returns headers object with Bearer token. */
export function authHeader(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}
