import fp from "fastify-plugin";
import fjwt from "@fastify/jwt";
import fcookie from "@fastify/cookie";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { UserRole } from "@prisma/client";

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string;
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      role: UserRole,
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

const PUBLIC_ROUTES = [
  "/health",
  "/api/auth/login",
  "/api/auth/google",
  "/api/auth/refresh",
];

function isPublicRoute(url: string): boolean {
  if (PUBLIC_ROUTES.some((r) => url === r || url.startsWith(r + "/"))) {
    return true;
  }
  if (url.startsWith("/api/webhooks/")) return true;
  return false;
}

async function authPlugin(app: FastifyInstance) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  await app.register(fjwt, { secret });
  await app.register(fcookie, {
    secret: secret,
    hook: "onRequest",
    parseOptions: {},
  });

  app.decorate(
    "authenticate",
    async function (req: FastifyRequest, reply: FastifyReply) {
      try {
        const decoded = (await req.jwtVerify()) as JwtPayload;
        if (decoded.type !== "access") {
          return reply.code(401).send({ error: "Invalid token type" });
        }
      } catch {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    },
  );

  app.decorate("requireRole", function (role: UserRole) {
    return async function (req: FastifyRequest, reply: FastifyReply) {
      try {
        const decoded = (await req.jwtVerify()) as JwtPayload;
        if (decoded.type !== "access") {
          return reply.code(401).send({ error: "Invalid token type" });
        }
        if (decoded.role !== role) {
          return reply
            .code(403)
            .send({ error: "Forbidden: insufficient permissions" });
        }
      } catch {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    };
  });

  app.addHook("onRequest", async (req, reply) => {
    if (req.method === "OPTIONS") return;
    const url = req.url.split("?")[0];
    if (isPublicRoute(url)) return;
    if (!url.startsWith("/api/")) return;

    // SSE & image endpoints: accept token via query param since EventSource
    // and <img src=""> don't support custom headers (Authorization: Bearer)
    if (url.startsWith("/api/sse/") || url.endsWith("/image")) {
      const token =
        (req.query as Record<string, string>).token ||
        req.headers.authorization?.replace("Bearer ", "");
      if (token) {
        req.headers.authorization = `Bearer ${token}`;
      }
    }

    await app.authenticate(req, reply);
  });
}

export default fp(authPlugin, {
  name: "auth",
  fastify: "5.x",
});
