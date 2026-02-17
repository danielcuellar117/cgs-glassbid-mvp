import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";

export interface Project {
  id: string;
  name: string;
  clientName: string | null;
  address: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  jobs?: Job[];
}

export interface Job {
  id: string;
  projectId: string;
  status: string;
  progress: unknown;
  stageProgress: unknown;
  ssot: unknown;
  uploadToken: string | null;
  originalFileName: string | null;
  originalFileSize: number | null;
  storagePath: string | null;
  errorMessage: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => api.get<Project[]>("/projects"),
  });
}

export function useProject(id: string) {
  return useQuery<Project>({
    queryKey: ["projects", id],
    queryFn: () => api.get<Project>(`/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; clientName?: string; address?: string }) =>
      api.post<Project>("/projects", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; clientName?: string; address?: string }) =>
      api.patch<Project>(`/projects/${id}`, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects", vars.id] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
