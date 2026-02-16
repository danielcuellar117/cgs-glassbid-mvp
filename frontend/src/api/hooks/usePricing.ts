import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";

export interface PricebookVersion {
  id: string;
  version: number;
  effectiveDate: string;
  notes: string | null;
  createdAt: string;
}

export interface PricingRule {
  id: string;
  pricebookVersionId: string;
  name: string;
  category: string;
  formulaType: string;
  formulaJson: unknown;
  appliesTo: unknown;
  active: boolean;
  createdAt: string;
}

export function usePricebookVersions() {
  return useQuery<PricebookVersion[]>({
    queryKey: ["pricebook"],
    queryFn: () => api.get<PricebookVersion[]>("/pricing/pricebook"),
  });
}

export function useCreatePricebook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { version?: number; effectiveDate?: string; notes?: string }) =>
      api.post<PricebookVersion>("/pricing/pricebook", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricebook"] }),
  });
}

export function usePricingRules(pricebookVersionId: string) {
  return useQuery<PricingRule[]>({
    queryKey: ["pricing-rules", pricebookVersionId],
    queryFn: () =>
      api.get<PricingRule[]>(`/pricing/rules?pricebookVersionId=${pricebookVersionId}`),
    enabled: !!pricebookVersionId,
  });
}

export function useCreatePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      pricebookVersionId: string;
      name: string;
      category: string;
      formulaType: string;
      formulaJson: unknown;
      appliesTo?: unknown;
    }) => api.post<PricingRule>("/pricing/rules", data),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["pricing-rules", vars.pricebookVersionId] }),
  });
}

export function useUpdatePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      category?: string;
      formulaType?: string;
      formulaJson?: unknown;
      appliesTo?: unknown;
      active?: boolean;
    }) => api.patch<PricingRule>(`/pricing/rules/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing-rules"] }),
  });
}

export function useDeletePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/pricing/rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing-rules"] }),
  });
}

export function usePriceOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { jobId: string; itemKey: string; overridePrice: number; reason: string }) =>
      api.post("/pricing/override", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}
