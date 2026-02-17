import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../../../app/src/server.js";
import { prisma } from "../../../../app/src/lib/prisma.js";
import type { FastifyInstance } from "fastify";

const mockPrisma = vi.mocked(prisma);

describe("Project Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp({ logger: false });
  });

  describe("GET /api/projects", () => {
    it("should list all projects ordered by createdAt desc", async () => {
      const mockProjects = [
        { id: "p1", name: "Project A", clientName: "Client 1", address: "", createdAt: new Date(), jobs: [] },
        { id: "p2", name: "Project B", clientName: "Client 2", address: "", createdAt: new Date(), jobs: [] },
      ];
      mockPrisma.project.findMany.mockResolvedValue(mockProjects as any);

      const res = await app.inject({ method: "GET", url: "/api/projects" });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toHaveLength(2);
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        }),
      );
    });
  });

  describe("GET /api/projects/:id", () => {
    it("should return a project with jobs", async () => {
      const mockProject = {
        id: "p1",
        name: "Project A",
        clientName: "Client 1",
        address: "123 St",
        jobs: [{ id: "j1", status: "DONE", createdAt: new Date() }],
      };
      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);

      const res = await app.inject({ method: "GET", url: "/api/projects/p1" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.id).toBe("p1");
      expect(body.jobs).toHaveLength(1);
    });

    it("should return 404 for non-existent project", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const res = await app.inject({ method: "GET", url: "/api/projects/missing" });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /api/projects", () => {
    it("should create a project with valid data", async () => {
      const newProject = { id: "p-new", name: "New Project", clientName: "Client", address: "456 Ave" };
      mockPrisma.project.create.mockResolvedValue(newProject as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "New Project", clientName: "Client", address: "456 Ave" },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.payload).name).toBe("New Project");
    });

    it("should create project with empty address when not provided", async () => {
      mockPrisma.project.create.mockResolvedValue({ id: "p1", name: "P", clientName: "C", address: "" } as any);

      await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "P", clientName: "C" },
      });

      expect(mockPrisma.project.create).toHaveBeenCalledWith({
        data: { name: "P", clientName: "C", address: "" },
      });
    });

    it("should reject missing name", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { clientName: "Client" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("should reject missing clientName", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Name" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("PATCH /api/projects/:id", () => {
    it("should update project fields", async () => {
      const updated = { id: "p1", name: "Updated", clientName: "Client", address: "New Addr" };
      mockPrisma.project.update.mockResolvedValue(updated as any);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/projects/p1",
        payload: { name: "Updated", address: "New Addr" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).name).toBe("Updated");
    });

    it("should only update provided fields", async () => {
      mockPrisma.project.update.mockResolvedValue({ id: "p1", name: "Only Name" } as any);

      await app.inject({
        method: "PATCH",
        url: "/api/projects/p1",
        payload: { name: "Only Name" },
      });

      const call = mockPrisma.project.update.mock.calls[0][0] as any;
      expect(call.data).toHaveProperty("name");
      expect(call.data).not.toHaveProperty("clientName");
      expect(call.data).not.toHaveProperty("address");
    });
  });

  describe("DELETE /api/projects/:id", () => {
    it("should delete a project and return 204", async () => {
      mockPrisma.project.delete.mockResolvedValue({} as any);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/projects/p1",
      });

      expect(res.statusCode).toBe(204);
      expect(mockPrisma.project.delete).toHaveBeenCalledWith({
        where: { id: "p1" },
      });
    });
  });
});
