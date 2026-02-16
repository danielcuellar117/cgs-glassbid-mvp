import { useParams } from "react-router-dom";
import { useJobSsot } from "@/api/hooks/useJobs";
import { Loader2, Download, FileText, RefreshCw, ExternalLink } from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import { api } from "@/api/client";
import { formatDate } from "@/lib/utils";

interface OutputEntry {
  key: string;
  label: string;
  storagePath: string;
  generatedAt: string;
  version: number;
  sha256: string;
}

export function Results() {
  const { id } = useParams<{ id: string }>();
  const { data: ssot, isLoading, refetch } = useJobSsot(id!);
  const [regenerating, setRegenerating] = useState(false);

  const outputs: OutputEntry[] = useMemo(() => {
    if (!ssot?.outputs) return [];
    return (ssot.outputs as OutputEntry[]) ?? [];
  }, [ssot]);

  const handleDownload = useCallback(async (outputKey: string) => {
    try {
      const data = await api.get<{ url: string }>(`/downloads/${id}/outputs?key=${outputKey}`);
      window.open(data.url, "_blank");
    } catch (err) {
      console.error("Download failed:", err);
    }
  }, [id]);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      await api.post(`/downloads/${id}/regenerate`);
      refetch();
    } catch (err) {
      console.error("Regeneration failed:", err);
    } finally {
      setRegenerating(false);
    }
  }, [id, refetch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Results</h1>
          <p className="text-sm text-muted-foreground">
            Download generated PDFs or regenerate outputs.
          </p>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {regenerating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Regenerate
        </button>
      </div>

      {outputs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <FileText size={32} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">
            No outputs generated yet. Complete the pipeline to generate PDFs.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {outputs.map((output) => (
            <div
              key={output.key}
              className="rounded-lg border border-border bg-card p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{output.label}</h3>
                    <p className="text-xs text-muted-foreground">
                      Version {output.version} | {formatDate(output.generatedAt)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded bg-muted/50 p-2 text-xs font-mono text-muted-foreground">
                SHA256: {output.sha256?.slice(0, 16)}...
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleDownload(output.key)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Download size={14} />
                  Download
                </button>
                <button
                  onClick={() => handleDownload(output.key)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                  title="Preview in new tab"
                >
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Download all as ZIP */}
      {outputs.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <button
            onClick={() => handleDownload("all")}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Download size={14} />
            Download All (ZIP)
          </button>
        </div>
      )}
    </div>
  );
}
