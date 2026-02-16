import { useParams } from "react-router-dom";
import { useMeasurementTasks, useCompleteMeasurementTask } from "@/api/hooks/useMeasurementTasks";
import { useCreateRenderRequest, useRenderRequest } from "@/api/hooks/useRenderRequests";
import { Loader2, ZoomIn, ZoomOut, Crosshair, Ruler, RotateCcw, MonitorUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type MouseEvent as ReactMouseEvent,
} from "react";

type ToolMode = "pan" | "calibrate" | "measure";

interface Point {
  x: number;
  y: number;
}

interface CalibrationData {
  p1: Point;
  p2: Point;
  realValue: number;
  pixelsPerUnit: number;
}

export function MeasurementTool() {
  const { id: jobId, pageNum: pageNumStr } = useParams<{ id: string; pageNum: string }>();
  const pageNum = parseInt(pageNumStr ?? "1", 10);

  // State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolMode>("pan");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const [calibPoints, setCalibPoints] = useState<Point[]>([]);
  const [measurePoints, setMeasurePoints] = useState<Point[]>([]);
  const [measuredDistance, setMeasuredDistance] = useState<number | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [calibInput, setCalibInput] = useState("");
  const [showCalibDialog, setShowCalibDialog] = useState(false);

  // Data hooks
  const { data: tasks } = useMeasurementTasks(jobId!);
  const completeMeasurement = useCompleteMeasurementTask();
  const createRender = useCreateRenderRequest();
  const [renderId, setRenderId] = useState<string | null>(null);
  const renderReq = useRenderRequest(renderId ?? "");

  const pageTasks = (tasks ?? []).filter((t) => t.pageNum === pageNum);

  // Request high-DPI render
  useEffect(() => {
    if (!jobId || renderId) return;
    createRender.mutate(
      { jobId: jobId!, pageNum, kind: "MEASURE", dpi: 200 },
      { onSuccess: (data) => setRenderId(data.id) },
    );
  }, [jobId, pageNum]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once render is done, load the image
  useEffect(() => {
    if (renderReq.data?.status === "DONE" && renderReq.data.outputPath) {
      setImageUrl(`/api/render-requests/${renderReq.data.id}/image`);
    }
  }, [renderReq.data]);

  // Load image onto canvas
  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      draw();
    };
    img.src = imageUrl;
  }, [imageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth ?? 800;
    canvas.height = canvas.parentElement?.clientHeight ?? 600;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // Draw image
    ctx.drawImage(img, 0, 0);

    // Draw calibration points
    if (calibPoints.length > 0) {
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2 / zoom;
      for (const p of calibPoints) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 / zoom, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (calibPoints.length === 2) {
        ctx.beginPath();
        ctx.moveTo(calibPoints[0].x, calibPoints[0].y);
        ctx.lineTo(calibPoints[1].x, calibPoints[1].y);
        ctx.stroke();
      }
    }

    // Draw measurement line
    if (measurePoints.length > 0) {
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2 / zoom;
      for (const p of measurePoints) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = "#3b82f6";
        ctx.fill();
      }
      if (measurePoints.length === 2) {
        ctx.beginPath();
        ctx.moveTo(measurePoints[0].x, measurePoints[0].y);
        ctx.lineTo(measurePoints[1].x, measurePoints[1].y);
        ctx.stroke();

        // Show measurement label
        if (measuredDistance != null) {
          const mx = (measurePoints[0].x + measurePoints[1].x) / 2;
          const my = (measurePoints[0].y + measurePoints[1].y) / 2 - 10 / zoom;
          ctx.fillStyle = "#1e40af";
          ctx.font = `bold ${14 / zoom}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(`${measuredDistance.toFixed(2)}"`, mx, my);
        }
      }
    }

    ctx.restore();
  }, [offset, zoom, calibPoints, measurePoints, measuredDistance]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Canvas to image coordinates
  const canvasToImg = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>): Point => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left - offset.x) / zoom,
        y: (e.clientY - rect.top - offset.y) / zoom,
      };
    },
    [offset, zoom],
  );

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      if (tool === "pan") {
        setDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
        return;
      }

      const pt = canvasToImg(e);

      if (tool === "calibrate") {
        if (calibPoints.length < 2) {
          const next = [...calibPoints, pt];
          setCalibPoints(next);
          if (next.length === 2) {
            setShowCalibDialog(true);
          }
        }
      }

      if (tool === "measure") {
        if (measurePoints.length < 2) {
          const next = [...measurePoints, pt];
          setMeasurePoints(next);
          if (next.length === 2 && calibration) {
            const dx = next[1].x - next[0].x;
            const dy = next[1].y - next[0].y;
            const pixelDist = Math.sqrt(dx * dx + dy * dy);
            const realDist = pixelDist / calibration.pixelsPerUnit;
            setMeasuredDistance(realDist);
          }
        }
      }
    },
    [tool, calibPoints, measurePoints, calibration, offset, canvasToImg],
  );

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      if (dragging && tool === "pan") {
        setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      }
    },
    [dragging, tool, dragStart],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.max(0.1, Math.min(10, z * delta)));
    },
    [],
  );

  const finishCalibration = useCallback(() => {
    if (calibPoints.length === 2 && calibInput) {
      const realVal = parseFloat(calibInput);
      if (isNaN(realVal) || realVal <= 0) return;
      const dx = calibPoints[1].x - calibPoints[0].x;
      const dy = calibPoints[1].y - calibPoints[0].y;
      const pixelDist = Math.sqrt(dx * dx + dy * dy);
      setCalibration({
        p1: calibPoints[0],
        p2: calibPoints[1],
        realValue: realVal,
        pixelsPerUnit: pixelDist / realVal,
      });
      setShowCalibDialog(false);
      setCalibInput("");
      setTool("measure");
    }
  }, [calibPoints, calibInput]);

  const assignToTask = useCallback(
    async (taskId: string) => {
      if (measuredDistance == null) return;
      await completeMeasurement.mutateAsync({
        id: taskId,
        measuredValue: parseFloat(measuredDistance.toFixed(4)),
        measuredBy: "operator",
        auditTrail: {
          calibration,
          measurePoints,
          distance: measuredDistance,
        },
      });
      setMeasurePoints([]);
      setMeasuredDistance(null);
      setSelectedTask(null);
    },
    [measuredDistance, calibration, measurePoints, completeMeasurement],
  );

  const handleReRenderHD = useCallback(() => {
    if (!jobId) return;
    createRender.mutate(
      { jobId, pageNum, kind: "MEASURE", dpi: 400 },
      { onSuccess: (data) => setRenderId(data.id) },
    );
    setImageUrl(null);
  }, [jobId, pageNum, createRender]);

  const isLoading = !imageUrl;

  return (
    <div className="flex h-[calc(100vh-7.5rem)] gap-0">
      {/* Toolbar */}
      <div className="flex w-12 flex-col items-center gap-1 border-r border-border bg-card py-2">
        {[
          { mode: "pan" as ToolMode, icon: RotateCcw, label: "Pan" },
          { mode: "calibrate" as ToolMode, icon: Crosshair, label: "Calibrate" },
          { mode: "measure" as ToolMode, icon: Ruler, label: "Measure" },
        ].map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            title={label}
            onClick={() => {
              setTool(mode);
              if (mode === "calibrate") {
                setCalibPoints([]);
                setShowCalibDialog(false);
              }
              if (mode === "measure") {
                setMeasurePoints([]);
                setMeasuredDistance(null);
              }
            }}
            className={cn(
              "rounded p-2 transition-colors",
              tool === mode ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            <Icon size={18} />
          </button>
        ))}
        <div className="my-1 w-6 border-t border-border" />
        <button
          title="Zoom in"
          onClick={() => setZoom((z) => Math.min(10, z * 1.2))}
          className="rounded p-2 hover:bg-muted"
        >
          <ZoomIn size={18} />
        </button>
        <button
          title="Zoom out"
          onClick={() => setZoom((z) => Math.max(0.1, z / 1.2))}
          className="rounded p-2 hover:bg-muted"
        >
          <ZoomOut size={18} />
        </button>
        <div className="my-1 w-6 border-t border-border" />
        <button
          title="Render HD"
          onClick={handleReRenderHD}
          className="rounded p-2 hover:bg-muted"
        >
          <MonitorUp size={18} />
        </button>
      </div>

      {/* Canvas area */}
      <div className="relative flex-1 overflow-hidden bg-gray-100">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading page render...</span>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className={cn(
              "h-full w-full",
              tool === "pan" && "cursor-grab",
              tool === "calibrate" && "cursor-crosshair",
              tool === "measure" && "cursor-crosshair",
              dragging && "cursor-grabbing",
            )}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          />
        )}

        {/* Calibration dialog */}
        {showCalibDialog && (
          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-3 font-semibold">Calibrate Scale</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Enter the real-world measurement (in inches) for the line you drew.
            </p>
            <input
              type="number"
              step="0.01"
              value={calibInput}
              onChange={(e) => setCalibInput(e.target.value)}
              placeholder='e.g., 36 (for 36")'
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && finishCalibration()}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCalibDialog(false);
                  setCalibPoints([]);
                }}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={finishCalibration}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Set Scale
              </button>
            </div>
          </div>
        )}

        {/* Status bar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-card/90 border-t border-border px-4 py-1.5 text-xs backdrop-blur">
          <span>Page {pageNum} | Zoom: {(zoom * 100).toFixed(0)}%</span>
          {calibration && (
            <span className="text-green-600 font-medium">
              Calibrated: {calibration.pixelsPerUnit.toFixed(1)} px/in
            </span>
          )}
          {measuredDistance != null && (
            <span className="font-semibold text-blue-600">
              Measured: {measuredDistance.toFixed(2)}"
            </span>
          )}
        </div>
      </div>

      {/* Task sidebar */}
      <div className="w-64 overflow-y-auto border-l border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Measurement Tasks</h3>
        {pageTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tasks for this page.</p>
        ) : (
          <div className="space-y-2">
            {pageTasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "rounded-md border p-3 text-xs transition-colors cursor-pointer",
                  task.status === "PENDING"
                    ? "border-orange-200 bg-orange-50"
                    : "border-border bg-muted/30 opacity-60",
                  selectedTask === task.id && "ring-2 ring-primary",
                )}
                onClick={() => setSelectedTask(task.id)}
              >
                <div className="flex justify-between">
                  <span className="font-medium">{task.field}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      task.status === "PENDING" ? "bg-orange-200 text-orange-800" : "bg-green-200 text-green-800",
                    )}
                  >
                    {task.status}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">Item: {task.itemKey}</p>
                {task.measuredValue != null && (
                  <p className="mt-1 font-medium">{task.measuredValue}"</p>
                )}
                {task.status === "PENDING" && measuredDistance != null && selectedTask === task.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      assignToTask(task.id);
                    }}
                    disabled={completeMeasurement.isPending}
                    className="mt-2 w-full rounded bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Assign {measuredDistance.toFixed(2)}" to this task
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 border-t border-border pt-3">
          <h4 className="mb-1 text-xs font-medium text-muted-foreground">Instructions</h4>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-muted-foreground">
            <li>Select <strong>Calibrate</strong>, click two points on a known dimension</li>
            <li>Enter the real measurement (inches)</li>
            <li>Select <strong>Measure</strong>, click two endpoints</li>
            <li>Click a task, then assign the measurement</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
