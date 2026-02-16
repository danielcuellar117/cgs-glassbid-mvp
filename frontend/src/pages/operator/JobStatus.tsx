import { useParams, useNavigate, Link } from "react-router-dom";
import { useJob } from "@/api/hooks/useJobs";
import { PipelineStepper } from "@/components/shared/PipelineStepper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import { Loader2, ArrowRight, RefreshCw, AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function JobStatus() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: job, isLoading, refetch } = useJob(id!);
  const [sseStatus, setSseStatus] = useState<string | null>(null);
  const [sseProgress, setSseProgress] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // SSE connection for real-time updates
  useEffect(() => {
    if (!id) return;
    const es = new EventSource(`/api/sse/jobs/${id}`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status) setSseStatus(data.status);
        if (data.progress) setSseProgress(JSON.stringify(data.progress));
        refetch();
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [id, refetch]);

  if (isLoading || !job) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status = sseStatus || job.status;
  const isDone = status === "DONE";
  const isFailed = status === "FAILED";
  const needsReview = status === "NEEDS_REVIEW";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Job Pipeline</h1>
          <p className="text-sm text-muted-foreground font-mono">
            {job.id.slice(0, 8)}... | {job.originalFileName ?? "Unknown file"}
          </p>
        </div>
        <StatusBadge status={status} className="text-sm px-3 py-1" />
      </div>

      {/* Pipeline Stepper */}
      <div className="rounded-lg border border-border bg-card p-6">
        <PipelineStepper currentStatus={status} />

        {sseProgress && (
          <p className="mt-4 text-sm text-muted-foreground">{sseProgress}</p>
        )}
      </div>

      {/* Action cards based on state */}
      {isFailed && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 text-destructive" size={20} />
            <div>
              <h3 className="font-semibold text-destructive">Pipeline Failed</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The job encountered an error. Check the progress data for details.
              </p>
              {job.progress != null && (
                <pre className="mt-3 rounded bg-muted p-3 text-xs overflow-auto max-h-40">
                  {String(JSON.stringify(job.progress, null, 2))}
                </pre>
              )}
              <button
                className="mt-3 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                onClick={() => refetch()}
              >
                <RefreshCw size={14} /> Retry Check
              </button>
            </div>
          </div>
        </div>
      )}

      {needsReview && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-6">
          <h3 className="font-semibold text-orange-900">Review Required</h3>
          <p className="mt-1 text-sm text-orange-700">
            Items have been extracted. Please review and complete any measurement tasks.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => navigate(`/jobs/${id}/pages`)}
              className="inline-flex items-center gap-1 rounded-md border border-orange-300 px-3 py-1.5 text-sm font-medium text-orange-800 hover:bg-orange-100"
            >
              View Pages
            </button>
            <button
              onClick={() => navigate(`/jobs/${id}/review`)}
              className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
            >
              Review Items <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {isDone && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h3 className="font-semibold text-green-900">Pipeline Complete!</h3>
          <p className="mt-1 text-sm text-green-700">
            PDFs have been generated and are ready for download.
          </p>
          <button
            onClick={() => navigate(`/jobs/${id}/results`)}
            className="mt-4 inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
          >
            View Results <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Quick navigation */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Pages", to: `/jobs/${id}/pages` },
          { label: "Review", to: `/jobs/${id}/review` },
          { label: "Pricing", to: `/jobs/${id}/pricing` },
          { label: "Results", to: `/jobs/${id}/results` },
        ].map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-lg border border-border bg-card p-3 text-center text-sm font-medium transition-colors hover:bg-muted hover:border-primary/30"
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Job metadata */}
      <div className="rounded-lg border border-border bg-card p-6 text-sm">
        <h3 className="mb-3 font-semibold">Job Details</h3>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">ID</dt>
          <dd className="font-mono text-xs">{job.id}</dd>
          <dt className="text-muted-foreground">Created</dt>
          <dd>{formatDate(job.createdAt)}</dd>
          <dt className="text-muted-foreground">Updated</dt>
          <dd>{formatDate(job.updatedAt)}</dd>
          <dt className="text-muted-foreground">File</dt>
          <dd>{job.originalFileName ?? "—"}</dd>
        </dl>
      </div>
    </div>
  );
}
