import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Loader2, Layers } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/DataTable";

interface TemplateMapping {
  id: string;
  configurationPattern: string;
  templateId: string;
  priority: number;
  createdAt: string;
}

export function TemplateConfig() {
  const { data: mappings, isLoading } = useQuery<TemplateMapping[]>({
    queryKey: ["template-mappings"],
    queryFn: async () => {
      try {
        return await api.get<TemplateMapping[]>("/jobs/template-mappings");
      } catch {
        // Fallback if endpoint doesn't exist yet
        return [];
      }
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "configurationPattern",
      header: "Configuration Pattern",
      render: (row) => (
        <span className="font-mono text-sm">{String(row.configurationPattern)}</span>
      ),
    },
    {
      key: "templateId",
      header: "Template ID",
      render: (row) => (
        <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          {String(row.templateId)}
        </span>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
    },
    {
      key: "createdAt",
      header: "Created",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {new Date(String(row.createdAt)).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Template Configuration</h1>
        <p className="text-sm text-muted-foreground">
          Mappings between glass configurations and shop drawing templates.
        </p>
      </div>

      {(mappings ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Layers size={40} className="mb-3 text-muted-foreground" />
          <h3 className="text-lg font-medium">No template mappings found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Template mappings are defined by the configuration_template_map table.
          </p>
        </div>
      ) : (
        <DataTable
          data={(mappings ?? []) as unknown as Record<string, unknown>[]}
          columns={columns}
          keyExtractor={(row) => String(row.id)}
          emptyMessage="No template mappings defined."
        />
      )}

      {/* Template registry info */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="mb-3 font-semibold">Implemented Templates</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Templates are Python modules in <code className="rounded bg-muted px-1.5 py-0.5 text-xs">worker/src/generators/templates/</code>.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { id: "TPL-02", name: "Inline Panel + Door" },
            { id: "TPL-04", name: "90-Degree Corner + Door" },
            { id: "TPL-07", name: "Bathtub Fixed Panel" },
            { id: "TPL-09", name: "Vanity Mirror" },
          ].map((tpl) => (
            <div
              key={tpl.id}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
            >
              <span className="inline-flex h-6 w-14 items-center justify-center rounded bg-green-100 text-[10px] font-medium text-green-800">
                {tpl.id}
              </span>
              <span className="text-sm">{tpl.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
