import { useState, useEffect, useRef, useCallback } from "react";
import { useCreateRenderRequest, useRenderRequest } from "@/api/hooks/useRenderRequests";
import { getAccessToken } from "@/contexts/AuthContext";
import { Loader2, ImageOff, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

function buildAuthImageUrl(renderRequestId: string): string {
  const token = getAccessToken();
  const base = `/api/render-requests/${renderRequestId}/image`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

interface PageThumbnailProps {
  readonly jobId: string;
  readonly pageNum: number;
  readonly className?: string;
  readonly onClick?: () => void;
}

export function PageThumbnail({ jobId, pageNum, className, onClick }: PageThumbnailProps) {
  const [requestId, setRequestId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const createRender = useCreateRenderRequest();
  const renderRequest = useRenderRequest(requestId ?? "");
  const requested = useRef(false);

  // Lazy loading: only trigger when element is visible in viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Create render request only when visible
  useEffect(() => {
    if (!isVisible || requested.current || imageUrl) return;
    requested.current = true;
    createRender.mutate(
      { jobId, pageNum, kind: "THUMB" },
      {
        onSuccess: (data: any) => {
          if (data.status === "DONE" && (data.outputKey || data.output_key)) {
            setImageUrl(buildAuthImageUrl(data.id));
          } else {
            setRequestId(data.id);
          }
        },
        onError: () => setError(true),
      },
    );
  }, [isVisible, jobId, pageNum, imageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll until render request is DONE
  useEffect(() => {
    if (!requestId || imageUrl) return;
    const data = renderRequest.data as any;
    if (data?.status === "DONE" && (data.outputKey || data.output_key)) {
      setImageUrl(buildAuthImageUrl(data.id));
    } else if (data?.status === "FAILED") {
      setError(true);
    }
  }, [renderRequest.data, requestId, imageUrl]);

  // Poll every 3s if still pending (longer interval to reduce load)
  useEffect(() => {
    if (!requestId || imageUrl || error) return;
    const interval = setInterval(() => {
      renderRequest.refetch();
    }, 3000);
    return () => clearInterval(interval);
  }, [requestId, imageUrl, error, renderRequest]);

  const handleClick = useCallback(() => {
    if (onClick) onClick();
  }, [onClick]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (onClick && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onClick();
      }
    },
    [onClick],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex items-center justify-center rounded-lg border border-border bg-white overflow-hidden",
        "h-32 w-24",
        onClick && "cursor-pointer hover:ring-2 hover:ring-primary/40",
        className,
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`Page ${pageNum}`}
          className="h-full w-full object-contain"
          loading="lazy"
          onError={() => setError(true)}
        />
      ) : error ? (
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <ImageOff size={20} />
          <span className="text-[10px]">Failed</span>
        </div>
      ) : !isVisible ? (
        <FileText size={20} className="text-muted-foreground/30" />
      ) : (
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
