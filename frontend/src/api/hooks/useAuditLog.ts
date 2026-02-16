import { useQuery } from "@tanstack/react-query";
import { api } from "../client";

export interface AuditLogEntry {
  id: string;
  jobId: string | null;
  actor: string;
  action: string;
  diff: unknown;
  createdAt: string;
}

export function useAuditLog(params: { jobId?: string; limit?: number; offset?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.jobId) qs.set("jobId", params.jobId);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return useQuery<AuditLogEntry[]>({
    queryKey: ["audit-log", params],
    queryFn: () => api.get<AuditLogEntry[]>(`/audit-log${query ? `?${query}` : ""}`),
  });
}
