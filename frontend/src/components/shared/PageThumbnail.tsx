import { useState, useEffect } from "react";
import { useCreateRenderRequest, useRenderRequest } from "@/api/hooks/useRenderRequests";
import { Loader2, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageThumbnailProps {
  jobId: string;
  pageNum: number;
  className?: string;
  onClick?: () => void;
}

export function PageThumbnail({ jobId, pageNum, className, onClick }: PageThumbnailProps) {
  const [requestId, setRequestId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const createRender = useCreateRenderRequest();
  const renderRequest = useRenderRequest(requestId ?? "");

  useEffect(() => {
    if (!requestId && !imageUrl) {
      createRender.mutate(
        { jobId, pageNum, kind: "THUMB" },
        {
          onSuccess: (data) => setRequestId(data.id),
        },
      );
    }
  }, [jobId, pageNum]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (renderRequest.data?.status === "DONE" && renderRequest.data.outputPath) {
      // Construct presigned URL from the output path
      setImageUrl(`/api/render-requests/${renderRequest.data.id}/image`);
    }
  }, [renderRequest.data]);

  const isLoading = !imageUrl && !renderRequest.data?.status?.includes("FAIL");
  const isFailed = renderRequest.data?.status === "FAILED";

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg border border-border bg-white overflow-hidden",
        "h-32 w-24",
        onClick && "cursor-pointer hover:ring-2 hover:ring-primary/40",
        className,
      )}
      onClick={onClick}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`Page ${pageNum}`}
          className="h-full w-full object-contain"
        />
      ) : isFailed ? (
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <ImageOff size={20} />
          <span className="text-[10px]">Failed</span>
        </div>
      ) : isLoading ? (
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      ) : null}
    </div>
  );
}
