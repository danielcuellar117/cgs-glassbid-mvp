import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";

export interface MeasurementTask {
  id: string;
  jobId: string;
  itemId: string;
  dimensionKey: string;
  pageNum: number;
  status: string;
  calibrationJson: unknown;
  measuredValue: number | null;
  measuredBy: string | null;
  measuredAt: string | null;
  createdAt: string;
}

export function useMeasurementTasks(jobId: string) {
  return useQuery<MeasurementTask[]>({
    queryKey: ["measurement-tasks", jobId],
    queryFn: () => api.get<MeasurementTask[]>(`/measurement-tasks?jobId=${jobId}`),
    enabled: !!jobId,
  });
}

export function useCompleteMeasurementTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      measuredValue,
      measuredBy,
      calibration,
    }: {
      id: string;
      measuredValue: number;
      measuredBy?: string;
      calibration?: Record<string, unknown>;
    }) => api.patch(`/measurement-tasks/${id}/complete`, { measuredValue, measuredBy, calibration }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurement-tasks"] });
    },
  });
}

export function useSkipMeasurementTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/measurement-tasks/${id}/skip`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurement-tasks"] });
    },
  });
}

export function useBulkSkipMeasurementTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskIds, reason }: { taskIds: string[]; reason: string }) =>
      api.post(`/measurement-tasks/skip-bulk`, { taskIds, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurement-tasks"] });
    },
  });
}

export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api.post(`/measurement-tasks/submit-review`, { jobId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["measurement-tasks"] });
    },
  });
}
