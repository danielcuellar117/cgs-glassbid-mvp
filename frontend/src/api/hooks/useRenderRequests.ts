import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";

export interface RenderRequest {
  id: string;
  jobId: string;
  pageNum: number;
  kind: string;
  dpi: number;
  status: string;
  outputPath: string | null;
  createdAt: string;
  completedAt: string | null;
}

export function useRenderRequest(id: string) {
  return useQuery<RenderRequest>({
    queryKey: ["render-requests", id],
    queryFn: () => api.get<RenderRequest>(`/render-requests/${id}`),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === "DONE" || data.status === "FAILED")) return false;
      return 2000;
    },
  });
}

export function useCreateRenderRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { jobId: string; pageNum: number; kind: string; dpi?: number }) =>
      api.post<RenderRequest>("/render-requests", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["render-requests"] });
    },
  });
}
