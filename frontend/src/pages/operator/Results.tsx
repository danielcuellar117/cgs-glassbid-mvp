import { useParams, Link } from "react-router-dom";
import { useJobSsot } from "@/api/hooks/useJobs";
import { Loader2, Download, FileText, RefreshCw, ExternalLink } from "lucide-react";
import { useMemo, useState, useCallback, useEffect } from "react";
import { api } from "@/api/client";
import { API_BASE } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { getAccessToken } from "@/contexts/AuthContext";

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface OutputEntry {
  outputId: string;
  type: string;
  key: string;
  bucket: string;
  generatedAt: string;
  version: number;
  sha256: string;
  downloadUrl?: string;
}

const TYPE_LABELS: Record<string, string> = {
  BID_PDF: "Bid Proposal",
  SHOP_DRAWINGS_PDF: "Shop Drawings",
};

export function Results() {
  const { id } = useParams<{ id: string }>();
  const { data: ssot, isLoading, refetch } = useJobSsot(id!);
  const [regenerating, setRegenerating] = useState(false);
  const [downloadUrls, setDownloadUrls] = useState<Record<string, string>>({});

  const outputs: OutputEntry[] = useMemo(() => {
    if (!ssot?.outputs) return [];
    return (ssot.outputs as OutputEntry[]) ?? [];
  }, [ssot]);

  // Fetch download URLs from the API (which returns proxy URLs)
  useEffect(() => {
    if (!id || outputs.length === 0) return;
    api.get<{ outputs: (OutputEntry & { downloadUrl: string })[] }>(`/downloads/${id}/outputs`)
      .then((data) => {
        const urls: Record<string, string> = {};
        for (const o of data.outputs) {
          urls[o.outputId] = o.downloadUrl;
        }
        setDownloadUrls(urls);
      })
      .catch(console.error);
  }, [id, outputs]);

  const buildUrl = useCallback((url: string) => {
    return `${API_BASE}${url.startsWith("/api") ? url.replace("/api", "") : url}`;
  }, []);

  const handleDownload = useCallback(async (output: OutputEntry) => {
    const url = downloadUrls[output.outputId];
    if (!url) return;
    try {
      const res = await fetch(buildUrl(url), { headers: authHeaders() });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = output.key.split("/").pop() || "download.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error("Download failed:", err);
    }
  }, [downloadUrls, buildUrl]);

  const handlePreview = useCallback(async (output: OutputEntry) => {
    const url = downloadUrls[output.outputId];
    if (!url) return;
    try {
      const res = await fetch(buildUrl(url), { headers: authHeaders() });
      if (!res.ok) throw new Error(`Preview failed: ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      globalThis.open(objectUrl, "_blank");
    } catch (err) {
      console.error("Preview failed:", err);
    }
  }, [downloadUrls, buildUrl]);

  const handleDownloadZip = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/downloads/${id}/zip`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`ZIP download failed: ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `job-${id?.slice(0, 8)}-outputs.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error("ZIP download failed:", err);
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
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <FileText size={32} className="mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No outputs generated yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your Bid Proposal and Shop Drawings will appear here after pricing is complete and PDFs are generated.
          </p>
          <Link
            to={`/jobs/${id}`}
            className="mt-4 text-sm font-medium text-primary hover:underline"
          >
            Check Pipeline Status &rarr;
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {outputs.map((output) => (
            <div
              key={output.outputId}
              className="rounded-lg border border-border bg-card p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{TYPE_LABELS[output.type] || output.type}</h3>
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
                  onClick={() => handleDownload(output)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Download size={14} />
                  Download
                </button>
                <button
                  onClick={() => handlePreview(output)}
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
            onClick={handleDownloadZip}
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
