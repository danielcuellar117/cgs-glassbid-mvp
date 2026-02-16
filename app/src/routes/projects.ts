import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function projectRoutes(app: FastifyInstance) {
  // List projects
  app.get("/", async (req, reply) => {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        jobs: {
          select: { id: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    return reply.send(projects);
  });

  // Get project by ID
  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        jobs: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!project) return reply.notFound("Project not found");
    return reply.send(project);
  });

  // Create project
  app.post<{
    Body: { name: string; clientName: string; address?: string };
  }>("/", async (req, reply) => {
    const { name, clientName, address } = req.body;
    if (!name || !clientName) {
      return reply.badRequest("name and clientName are required");
    }
    const project = await prisma.project.create({
      data: { name, clientName, address: address || "" },
    });
    return reply.status(201).send(project);
  });

  // Update project
  app.patch<{
    Params: { id: string };
    Body: { name?: string; clientName?: string; address?: string };
  }>("/:id", async (req, reply) => {
    const { name, clientName, address } = req.body;
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(clientName !== undefined && { clientName }),
        ...(address !== undefined && { address }),
      },
    });
    return reply.send(project);
  });

  // Delete project
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    await prisma.project.delete({ where: { id: req.params.id } });
    return reply.status(204).send();
  });
}
