import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const SALT_ROUNDS = 12;

export async function adminUserRoutes(app: FastifyInstance) {
  // All routes require ADMIN role
  app.addHook("onRequest", app.requireRole(UserRole.ADMIN));

  // GET /api/admin/users — list all users
  app.get<{
    Querystring: { page?: string; limit?: string; search?: string };
  }>("/", async (req, reply) => {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "50", 10)));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim();

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tenantId: true,
          isActive: true,
          googleId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return reply.send({ users, total, page, limit });
  });

  // GET /api/admin/users/:id — get single user
  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        isActive: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) return reply.notFound("User not found");
    return reply.send(user);
  });

  // POST /api/admin/users — create a new user
  app.post<{
    Body: {
      email: string;
      name: string;
      role?: UserRole;
      password?: string;
    };
  }>("/", async (req, reply) => {
    const { email, name, role, password } = req.body;
    if (!email || !name) {
      return reply.badRequest("email and name are required");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.conflict("A user with this email already exists");
    }

    let passwordHash: string | null = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: role || UserRole.OPERATOR,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return reply.status(201).send(user);
  });

  // PATCH /api/admin/users/:id — update user
  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      role?: UserRole;
      isActive?: boolean;
      password?: string;
    };
  }>("/:id", async (req, reply) => {
    const { name, role, isActive, password } = req.body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (role !== undefined) data.role = role;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) {
      data.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    try {
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tenantId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return reply.send(user);
    } catch {
      return reply.notFound("User not found");
    }
  });

  // DELETE /api/admin/users/:id — deactivate user (soft delete)
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    try {
      await prisma.user.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });
      return reply.status(204).send();
    } catch {
      return reply.notFound("User not found");
    }
  });
}
