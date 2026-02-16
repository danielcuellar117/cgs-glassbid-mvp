import { useParams, useNavigate } from "react-router-dom";
import { useJobSsot } from "@/api/hooks/useJobs";
import { PageThumbnail } from "@/components/shared/PageThumbnail";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

interface PageEntry {
  pageNum: number;
  classification: string;
  relevant: boolean;
  tags?: string[];
}

export function PageIndex() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: ssot, isLoading } = useJobSsot(id!);

  const pages: PageEntry[] = useMemo(() => {
    if (!ssot) return [];
    const pageIndex = ssot.pageIndex as PageEntry[] | undefined;
    if (Array.isArray(pageIndex)) return pageIndex;
    return [];
  }, [ssot]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Page Index</h1>
        <p className="text-sm text-muted-foreground">
          {pages.length} pages indexed. Click a page to view details.
        </p>
      </div>

      {pages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-muted-foreground">No pages indexed yet. The pipeline may still be processing.</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {pages.map((page) => (
            <div key={page.pageNum} className="flex flex-col items-center gap-2">
              <PageThumbnail
                jobId={id!}
                pageNum={page.pageNum}
                onClick={() => navigate(`/jobs/${id}/measure/${page.pageNum}`)}
              />
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-medium">Page {page.pageNum}</span>
                <StatusBadge
                  status={page.classification || "UNKNOWN"}
                  className="text-[10px]"
                />
                {page.relevant && (
                  <span className="text-[10px] text-green-600 font-medium">Relevant</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
