import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import authPlugin from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { adminUserRoutes } from "./routes/admin-users.js";
import { projectRoutes } from "./routes/projects.js";
import { jobRoutes } from "./routes/jobs.js";
import { renderRequestRoutes } from "./routes/render-requests.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { sseRoutes } from "./routes/sse.js";
import { measurementTaskRoutes } from "./routes/measurement-tasks.js";
import { calibrationRoutes } from "./routes/calibration.js";
import { pricingRoutes } from "./routes/pricing.js";
import { downloadRoutes } from "./routes/downloads.js";
import { auditLogRoutes } from "./routes/audit-log.js";

const PORT = parseInt(process.env.APP_PORT || "3000", 10);
const HOST = "0.0.0.0";

/**
 * Build and configure the Fastify application instance.
 * Exported for testing via fastify.inject().
 */
export async function buildApp(
  opts: { logger?: boolean | object } = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? {
      level: process.env.LOG_LEVEL || "info",
    },
  });

  // Plugins
  const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
  await app.register(cors, {
    origin: [corsOrigin, "http://localhost:5173"],
    credentials: true,
  });
  await app.register(sensible);
  await app.register(authPlugin);

  // Routes
  await app.register(healthRoutes, { prefix: "/health" });
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(adminUserRoutes, { prefix: "/api/admin/users" });
  await app.register(projectRoutes, { prefix: "/api/projects" });
  await app.register(jobRoutes, { prefix: "/api/jobs" });
  await app.register(renderRequestRoutes, { prefix: "/api/render-requests" });
  await app.register(webhookRoutes, { prefix: "/api/webhooks" });
  await app.register(sseRoutes, { prefix: "/api/sse" });
  await app.register(measurementTaskRoutes, { prefix: "/api/measurement-tasks" });
  await app.register(calibrationRoutes, { prefix: "/api/calibration" });
  await app.register(pricingRoutes, { prefix: "/api/pricing" });
  await app.register(downloadRoutes, { prefix: "/api/downloads" });
  await app.register(auditLogRoutes, { prefix: "/api/audit-log" });

  return app;
}

async function main() {
  const app = await buildApp();
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`BFF listening on ${HOST}:${PORT}`);
}

// Only start the server when run directly (not when imported for testing)
const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("server.ts") ||
   process.argv[1].endsWith("server.js"));

if (isDirectRun) {
  main().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
