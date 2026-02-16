import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import type { Job } from "./useProjects";

export type { Job };

export function useJobs(projectId?: string) {
  const params = projectId ? `?projectId=${projectId}` : "";
  return useQuery<Job[]>({
    queryKey: ["jobs", projectId ?? "all"],
    queryFn: () => api.get<Job[]>(`/jobs${params}`),
  });
}

export function useJob(id: string) {
  return useQuery<Job>({
    queryKey: ["jobs", "detail", id],
    queryFn: () => api.get<Job>(`/jobs/${id}`),
    enabled: !!id,
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { projectId: string; originalFileName?: string; originalFileSize?: number }) =>
      api.post<Job & { uploadToken: string }>("/jobs", data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["jobs", vars.projectId] });
    },
  });
}

export function useJobSsot(jobId: string) {
  return useQuery<Record<string, unknown>>({
    queryKey: ["jobs", "ssot", jobId],
    queryFn: () => api.get<Record<string, unknown>>(`/jobs/${jobId}/ssot`),
    enabled: !!jobId,
  });
}

export function useUpdateSsot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, patch }: { jobId: string; patch: Record<string, unknown> }) =>
      api.patch(`/jobs/${jobId}/ssot`, patch),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["jobs", "ssot", vars.jobId] });
    },
  });
}

export function useJobSSE(jobId: string) {
  // Returns the SSE URL; caller manages the EventSource lifecycle
  const url = `/api/sse/jobs/${jobId}`;
  return { url };
}
