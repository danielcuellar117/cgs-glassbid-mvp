import { useParams } from "react-router-dom";
import { useMeasurementTasks, useCompleteMeasurementTask, useSkipMeasurementTask, useBulkSkipMeasurementTasks } from "@/api/hooks/useMeasurementTasks";
import { useCreateRenderRequest, useRenderRequest } from "@/api/hooks/useRenderRequests";
import { SkipReasonDialog } from "@/components/shared/SkipReasonDialog";
import { Loader2, ZoomIn, ZoomOut, Crosshair, Ruler, RotateCcw, MonitorUp, SkipForward, Ban, Info, CheckCircle2, ArrowRight, Move } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type MouseEvent as ReactMouseEvent,
} from "react";

type ToolMode = "pan" | "calibrate" | "measure";

interface Point { x: number; y: number }

interface CalibrationData {
  p1: Point;
  p2: Point;
  realValue: number;
  pixelsPerUnit: number;
}

// ── Constants ──
const MINIMAP_MIN_W = 240;
const MINIMAP_MIN_H = 180;
const MINIMAP_MAX_W = 480;
const MINIMAP_MAX_H = 360;
const ELASTIC_FACTOR = 0.25;
const SNAP_SPEED = 0.15;

const FRACTION_OPTIONS = [
  { label: "0", value: 0 },
  { label: "1/16", value: 1 / 16 },
  { label: "1/8", value: 1 / 8 },
  { label: "3/16", value: 3 / 16 },
  { label: "1/4", value: 1 / 4 },
  { label: "5/16", value: 5 / 16 },
  { label: "3/8", value: 3 / 8 },
  { label: "7/16", value: 7 / 16 },
  { label: "1/2", value: 1 / 2 },
  { label: "9/16", value: 9 / 16 },
  { label: "5/8", value: 5 / 8 },
  { label: "11/16", value: 11 / 16 },
  { label: "3/4", value: 3 / 4 },
  { label: "13/16", value: 13 / 16 },
  { label: "7/8", value: 7 / 8 },
  { label: "15/16", value: 15 / 16 },
] as const;

function toArchitecturalString(totalInches: number): string {
  const ft = Math.floor(totalInches / 12);
  const remainingInches = totalInches - ft * 12;
  const wholeInches = Math.floor(remainingInches);
  const fractional = remainingInches - wholeInches;

  let fracStr = "";
  if (fractional > 0.001) {
    const sixteenths = Math.round(fractional * 16);
    if (sixteenths === 16) {
      return toArchitecturalString(ft * 12 + wholeInches + 1);
    }
    if (sixteenths === 8) fracStr = "1/2";
    else if (sixteenths === 4) fracStr = "1/4";
    else if (sixteenths === 12) fracStr = "3/4";
    else if (sixteenths % 2 === 0) fracStr = `${sixteenths / 2}/8`;
    else fracStr = `${sixteenths}/16`;
  }

  const parts: string[] = [];
  if (ft > 0) parts.push(`${ft}'`);
  if (wholeInches > 0 && fracStr) parts.push(`${wholeInches} ${fracStr}"`);
  else if (wholeInches > 0) parts.push(`${wholeInches}"`);
  else if (fracStr) parts.push(`${fracStr}"`);
  else if (ft === 0) parts.push(`0"`);

  return parts.join(" - ");
}

export function MeasurementTool() {
  const { id: jobId, pageNum: pageNumStr } = useParams<{ id: string; pageNum: string }>();
  const pageNum = Number.parseInt(pageNumStr ?? "1", 10);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // ── Interaction refs (bypass React for 60fps) ──
  const offsetRef = useRef<Point>({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const draggingRef = useRef(false);
  const minimapDraggingRef = useRef(false);
  const minimapResizingRef = useRef(false);
  const minimapResizeStartRef = useRef<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: MINIMAP_MIN_W, h: MINIMAP_MIN_H });
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const rafRef = useRef(0);
  const snapAnimRef = useRef(0);
  const calibPointsRef = useRef<Point[]>([]);
  const measurePointsRef = useRef<Point[]>([]);
  const measuredDistRef = useRef<number | null>(null);
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 800, h: 600 });

  // ── React state for UI ──
  const [tool, setTool] = useState<ToolMode>("pan");
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const calibrationRef = useRef<CalibrationData | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [calibInput, setCalibInput] = useState("");
  const [calibFeet, setCalibFeet] = useState("");
  const [calibInches, setCalibInches] = useState("");
  const [calibFraction, setCalibFraction] = useState(0);
  const [calibMode, setCalibMode] = useState<"combo" | "inches">("combo");
  const [showCalibDialog, setShowCalibDialog] = useState(false);
  const [calibDialogPos, setCalibDialogPos] = useState<Point | null>(null);
  const calibDialogDragRef = useRef<{ dragging: boolean; startMouse: Point; startPos: Point }>({
    dragging: false, startMouse: { x: 0, y: 0 }, startPos: { x: 0, y: 0 },
  });
  const [zoomDisplay, setZoomDisplay] = useState(1);
  const [measuredDistDisplay, setMeasuredDistDisplay] = useState<number | null>(null);
  const [minimapSize, setMinimapSize] = useState<{ w: number; h: number }>({ w: MINIMAP_MIN_W, h: MINIMAP_MIN_H });
  const [calibPointCount, setCalibPointCount] = useState(0);
  const [measurePointCount, setMeasurePointCount] = useState(0);

  const { data: tasks } = useMeasurementTasks(jobId!);
  const completeMeasurement = useCompleteMeasurementTask();
  const skipTask = useSkipMeasurementTask();
  const bulkSkip = useBulkSkipMeasurementTasks();
  const createRender = useCreateRenderRequest();
  const [renderId, setRenderId] = useState<string | null>(null);
  const renderReq = useRenderRequest(renderId ?? "");
  const [skipDialogTarget, setSkipDialogTarget] = useState<"single" | "page" | null>(null);
  const [skipTaskId, setSkipTaskId] = useState<string | null>(null);

  const pageTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.pageNum === pageNum),
    [tasks, pageNum],
  );
  const pendingPageTasks = useMemo(
    () => pageTasks.filter((t) => t.status === "PENDING"),
    [pageTasks],
  );

  // ── Render request ──
  useEffect(() => {
    if (!jobId || renderId) return;
    createRender.mutate(
      { jobId, pageNum, kind: "MEASURE", dpi: 200 },
      { onSuccess: (data) => setRenderId(data.id) },
    );
  }, [jobId, pageNum]); // eslint-disable-line react-hooks/exhaustive-deps

  const imageUrl = useMemo(() => {
    const d = renderReq.data;
    if (d?.status === "DONE" && d.outputKey) {
      return `/api/render-requests/${d.id}/image`;
    }
    return null;
  }, [renderReq.data]);

  // ── Elastic bounds helpers ──
  const clampOffset = useCallback((off: Point): Point => {
    const img = imgRef.current;
    if (!img) return off;
    const z = zoomRef.current;
    const cw = canvasSizeRef.current.w;
    const ch = canvasSizeRef.current.h;
    const iw = img.naturalWidth * z;
    const ih = img.naturalHeight * z;

    let cx: number;
    let cy: number;

    if (iw >= cw) {
      cx = Math.max(cw - iw, Math.min(0, off.x));
    } else {
      cx = (cw - iw) / 2;
    }

    if (ih >= ch) {
      cy = Math.max(ch - ih, Math.min(0, off.y));
    } else {
      cy = (ch - ih) / 2;
    }

    return { x: cx, y: cy };
  }, []);

  const applyElastic = useCallback((raw: Point): Point => {
    const clamped = clampOffset(raw);
    return {
      x: clamped.x + (raw.x - clamped.x) * ELASTIC_FACTOR,
      y: clamped.y + (raw.y - clamped.y) * ELASTIC_FACTOR,
    };
  }, [clampOffset]);

  // ── Canvas draw ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const off = offsetRef.current;
    const z = zoomRef.current;
    const cPts = calibPointsRef.current;
    const mPts = measurePointsRef.current;
    const mDist = measuredDistRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(off.x, off.y);
    ctx.scale(z, z);
    ctx.drawImage(img, 0, 0);

    if (cPts.length > 0) {
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2 / z;
      for (const p of cPts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 / z, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (cPts.length === 2) {
        ctx.beginPath();
        ctx.moveTo(cPts[0].x, cPts[0].y);
        ctx.lineTo(cPts[1].x, cPts[1].y);
        ctx.stroke();
      }
    }

    if (mPts.length > 0) {
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2 / z;
      for (const p of mPts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5 / z, 0, Math.PI * 2);
        ctx.fillStyle = "#3b82f6";
        ctx.fill();
      }
      if (mPts.length === 2) {
        ctx.beginPath();
        ctx.moveTo(mPts[0].x, mPts[0].y);
        ctx.lineTo(mPts[1].x, mPts[1].y);
        ctx.stroke();
        if (mDist != null) {
          const mx = (mPts[0].x + mPts[1].x) / 2;
          const my = (mPts[0].y + mPts[1].y) / 2 - 10 / z;
          ctx.fillStyle = "#1e40af";
          ctx.font = `bold ${14 / z}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(toArchitecturalString(mDist), mx, my);
        }
      }
    }

    ctx.restore();
  }, []);

  // ── Minimap drawing (uses current minimapSize via closure over refs) ──
  const drawMinimap = useCallback(() => {
    const mc = minimapRef.current;
    const img = imgRef.current;
    if (!mc || !img) return;

    const mCtx = mc.getContext("2d");
    if (!mCtx) return;

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (iw === 0 || ih === 0) return;

    const mw = mc.width;
    const mh = mc.height;
    const scale = Math.min(mw / iw, mh / ih);
    const dw = iw * scale;
    const dh = ih * scale;

    mCtx.fillStyle = "rgba(0,0,0,0.65)";
    mCtx.fillRect(0, 0, mw, mh);
    mCtx.drawImage(img, 0, 0, dw, dh);

    const z = zoomRef.current;
    const off = offsetRef.current;
    const cw = canvasSizeRef.current.w;
    const ch = canvasSizeRef.current.h;

    const vx = (-off.x / z) * scale;
    const vy = (-off.y / z) * scale;
    const vw = (cw / z) * scale;
    const vh = (ch / z) * scale;

    mCtx.strokeStyle = "#3b82f6";
    mCtx.lineWidth = 2;
    mCtx.strokeRect(vx, vy, vw, vh);
    mCtx.fillStyle = "rgba(59,130,246,0.1)";
    mCtx.fillRect(vx, vy, vw, vh);
  }, []);

  const scheduleDraw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      draw();
      drawMinimap();
    });
  }, [draw, drawMinimap]);

  // ── Snap-back animation ──
  const snapBack = useCallback(() => {
    cancelAnimationFrame(snapAnimRef.current);
    const animate = () => {
      const off = offsetRef.current;
      const target = clampOffset(off);
      const dx = target.x - off.x;
      const dy = target.y - off.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        offsetRef.current = target;
        scheduleDraw();
        return;
      }
      offsetRef.current = {
        x: off.x + dx * SNAP_SPEED,
        y: off.y + dy * SNAP_SPEED,
      };
      scheduleDraw();
      snapAnimRef.current = requestAnimationFrame(animate);
    };
    snapAnimRef.current = requestAnimationFrame(animate);
  }, [clampOffset, scheduleDraw]);

  // ── Resize canvas via ResizeObserver ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        canvasSizeRef.current = { w, h };
        scheduleDraw();
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();
    return () => ro.disconnect();
  }, [imageUrl, scheduleDraw]);

  // ── Load image ──
  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Center image at 100% zoom on load
      const cw = canvasSizeRef.current.w;
      const ch = canvasSizeRef.current.h;
      offsetRef.current = {
        x: (cw - img.naturalWidth) / 2,
        y: (ch - img.naturalHeight) / 2,
      };
      zoomRef.current = 1;
      setZoomDisplay(1);
      scheduleDraw();
    };
    img.src = imageUrl;
  }, [imageUrl, scheduleDraw]);

  // ── Coordinate conversion ──
  const canvasToImg = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const off = offsetRef.current;
      const z = zoomRef.current;
      return {
        x: (clientX - rect.left - off.x) / z,
        y: (clientY - rect.top - off.y) / z,
      };
    },
    [],
  );

  // ── Mouse handlers ──
  const handleMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      cancelAnimationFrame(snapAnimRef.current);
      if (tool === "pan") {
        draggingRef.current = true;
        dragStartRef.current = {
          x: e.clientX - offsetRef.current.x,
          y: e.clientY - offsetRef.current.y,
        };
        return;
      }

      const pt = canvasToImg(e.clientX, e.clientY);

      if (tool === "calibrate") {
        const cPts = calibPointsRef.current;
        if (cPts.length < 2) {
          const next = [...cPts, pt];
          calibPointsRef.current = next;
          setCalibPointCount(next.length);
          scheduleDraw();
          if (next.length === 2) setShowCalibDialog(true);
        }
      }

      if (tool === "measure") {
        const mPts = measurePointsRef.current;
        if (mPts.length < 2) {
          const next = [...mPts, pt];
          measurePointsRef.current = next;
          setMeasurePointCount(next.length);
          if (next.length === 2 && calibrationRef.current) {
            const dx = next[1].x - next[0].x;
            const dy = next[1].y - next[0].y;
            const realDist = Math.hypot(dx, dy) / calibrationRef.current.pixelsPerUnit;
            measuredDistRef.current = realDist;
            setMeasuredDistDisplay(realDist);
          }
          scheduleDraw();
        }
      }
    },
    [tool, canvasToImg, scheduleDraw],
  );

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      if (!draggingRef.current) return;
      const rawOff: Point = {
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      };
      offsetRef.current = applyElastic(rawOff);
      scheduleDraw();
    },
    [applyElastic, scheduleDraw],
  );

  const handleMouseUp = useCallback(() => {
    if (draggingRef.current) {
      draggingRef.current = false;
      snapBack();
    }
  }, [snapBack]);

  // ── Wheel zoom ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const oldZ = zoomRef.current;
      const newZ = Math.max(0.1, Math.min(10, oldZ * factor));
      zoomRef.current = newZ;

      // Zoom towards cursor position
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const off = offsetRef.current;
      offsetRef.current = {
        x: mx - (mx - off.x) * (newZ / oldZ),
        y: my - (my - off.y) * (newZ / oldZ),
      };

      setZoomDisplay(newZ);
      scheduleDraw();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [imageUrl, scheduleDraw]);

  // ── Reset view (100% zoom, centered) ──
  const handleResetView = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    zoomRef.current = 1;
    setZoomDisplay(1);
    const cw = canvasSizeRef.current.w;
    const ch = canvasSizeRef.current.h;
    offsetRef.current = {
      x: (cw - img.naturalWidth) / 2,
      y: (ch - img.naturalHeight) / 2,
    };
    scheduleDraw();
  }, [scheduleDraw]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "r" || e.key === "R" || e.key === "0") {
        e.preventDefault();
        handleResetView();
      }
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [handleResetView]);

  // ── Minimap click/drag navigation ──
  const minimapNavigate = useCallback(
    (clientX: number, clientY: number) => {
      const mc = minimapRef.current;
      const img = imgRef.current;
      if (!mc || !img) return;

      const rect = mc.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const scale = Math.min(mc.width / iw, mc.height / ih);

      const imgX = mx / scale;
      const imgY = my / scale;

      const z = zoomRef.current;
      const cw = canvasSizeRef.current.w;
      const ch = canvasSizeRef.current.h;
      offsetRef.current = {
        x: cw / 2 - imgX * z,
        y: ch / 2 - imgY * z,
      };
      scheduleDraw();
    },
    [scheduleDraw],
  );

  const handleMinimapMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      e.stopPropagation();
      minimapDraggingRef.current = true;
      minimapNavigate(e.clientX, e.clientY);
    },
    [minimapNavigate],
  );

  const handleMinimapMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      if (!minimapDraggingRef.current) return;
      minimapNavigate(e.clientX, e.clientY);
    },
    [minimapNavigate],
  );

  const handleMinimapMouseUp = useCallback(() => {
    minimapDraggingRef.current = false;
  }, []);

  // ── Minimap resize (drag top-left corner) ──
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!minimapResizingRef.current) return;
      const s = minimapResizeStartRef.current;
      const dxMouse = s.x - e.clientX;
      const dyMouse = s.y - e.clientY;
      const newW = Math.max(MINIMAP_MIN_W, Math.min(MINIMAP_MAX_W, s.w + dxMouse));
      const newH = Math.max(MINIMAP_MIN_H, Math.min(MINIMAP_MAX_H, s.h + dyMouse));
      setMinimapSize({ w: newW, h: newH });
    };
    const onUp = () => {
      minimapResizingRef.current = false;
    };
    globalThis.addEventListener("mousemove", onMove);
    globalThis.addEventListener("mouseup", onUp);
    return () => {
      globalThis.removeEventListener("mousemove", onMove);
      globalThis.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Redraw minimap when size changes
  useEffect(() => {
    const mc = minimapRef.current;
    if (mc) {
      mc.width = minimapSize.w;
      mc.height = minimapSize.h;
      drawMinimap();
    }
  }, [minimapSize, drawMinimap]);

  const handleMinimapResizeStart = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      minimapResizingRef.current = true;
      minimapResizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        w: minimapSize.w,
        h: minimapSize.h,
      };
    },
    [minimapSize],
  );

  // ── Calibration ──
  const getCalibValueInches = useCallback((): number | null => {
    if (calibMode === "inches") {
      const v = Number.parseFloat(calibInput);
      return Number.isNaN(v) || v <= 0 ? null : v;
    }
    const ft = Number.parseFloat(calibFeet || "0");
    const inc = Number.parseFloat(calibInches || "0");
    if (Number.isNaN(ft) || Number.isNaN(inc)) return null;
    const total = ft * 12 + inc + calibFraction;
    return total <= 0 ? null : total;
  }, [calibMode, calibInput, calibFeet, calibInches, calibFraction]);

  // ── Calibration dialog drag ──
  const handleDialogDragStart = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input, button, select")) return;
    e.preventDefault();
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const currentPos = calibDialogPos ?? { x: rect.left, y: rect.top };
    if (!calibDialogPos) setCalibDialogPos(currentPos);
    calibDialogDragRef.current = {
      dragging: true,
      startMouse: { x: e.clientX, y: e.clientY },
      startPos: currentPos,
    };
  }, [calibDialogPos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = calibDialogDragRef.current;
      if (!d.dragging) return;
      setCalibDialogPos({
        x: d.startPos.x + (e.clientX - d.startMouse.x),
        y: d.startPos.y + (e.clientY - d.startMouse.y),
      });
    };
    const onUp = () => { calibDialogDragRef.current.dragging = false; };
    globalThis.addEventListener("mousemove", onMove);
    globalThis.addEventListener("mouseup", onUp);
    return () => {
      globalThis.removeEventListener("mousemove", onMove);
      globalThis.removeEventListener("mouseup", onUp);
    };
  }, []);

  const finishCalibration = useCallback(() => {
    const cPts = calibPointsRef.current;
    const realVal = getCalibValueInches();
    if (cPts.length === 2 && realVal) {
      const pixelDist = Math.hypot(cPts[1].x - cPts[0].x, cPts[1].y - cPts[0].y);
      const cal: CalibrationData = {
        p1: cPts[0], p2: cPts[1],
        realValue: realVal,
        pixelsPerUnit: pixelDist / realVal,
      };
      calibrationRef.current = cal;
      setCalibration(cal);
      setShowCalibDialog(false);
      setCalibInput("");
      setCalibFeet("");
      setCalibInches("");
      setCalibFraction(0);
      setTool("measure");
    }
  }, [getCalibValueInches]);

  // ── Assign measurement ──
  const assignToTask = useCallback(
    async (taskId: string) => {
      const dist = measuredDistRef.current;
      if (dist == null) return;
      await completeMeasurement.mutateAsync({
        id: taskId,
        measuredValue: Number.parseFloat(dist.toFixed(4)),
        measuredBy: "operator",
        calibration: {
          calibrationData: calibrationRef.current,
          measurePoints: measurePointsRef.current,
          distance: dist,
        },
      });
      measurePointsRef.current = [];
      setMeasurePointCount(0);
      measuredDistRef.current = null;
      setMeasuredDistDisplay(null);
      setSelectedTask(null);
      scheduleDraw();
    },
    [completeMeasurement, scheduleDraw],
  );

  // ── HD re-render ──
  const handleReRenderHD = useCallback(() => {
    if (!jobId) return;
    setRenderId(null);
    createRender.mutate(
      { jobId, pageNum, kind: "MEASURE", dpi: 400 },
      { onSuccess: (data) => setRenderId(data.id) },
    );
  }, [jobId, pageNum, createRender]);

  // ── Zoom buttons ──
  const handleZoomIn = useCallback(() => {
    zoomRef.current = Math.min(10, zoomRef.current * 1.2);
    setZoomDisplay(zoomRef.current);
    scheduleDraw();
  }, [scheduleDraw]);

  const handleZoomOut = useCallback(() => {
    zoomRef.current = Math.max(0.1, zoomRef.current / 1.2);
    setZoomDisplay(zoomRef.current);
    scheduleDraw();
  }, [scheduleDraw]);

  // ── Contextual hint ──
  const contextHint = useMemo((): { icon: "info" | "check" | "arrow"; text: string; step?: string } => {
    if (!calibration) {
      if (tool !== "calibrate") {
        return { icon: "arrow", step: "Step 1 of 3", text: "Select the Calibrate tool (crosshair icon), then click two endpoints of a known dimension on the drawing." };
      }
      if (showCalibDialog) {
        return { icon: "info", step: "Step 1 of 3", text: "Enter the real-world length of the line you just drew." };
      }
      if (calibPointCount === 0) {
        return { icon: "info", step: "Step 1 of 3", text: "Click the first endpoint of a known dimension (e.g., a wall with a marked length)." };
      }
      return { icon: "info", step: "Step 1 of 3", text: "Now click the second endpoint to finish the reference line." };
    }
    if (measuredDistDisplay == null) {
      if (tool !== "measure") {
        return { icon: "arrow", step: "Step 2 of 3", text: "Scale is set! Select the Measure tool (ruler icon) and click two points to measure a distance." };
      }
      if (measurePointCount === 0) {
        return { icon: "info", step: "Step 2 of 3", text: "Click the first endpoint of the element you want to measure." };
      }
      return { icon: "info", step: "Step 2 of 3", text: "Click the second endpoint to complete the measurement." };
    }
    if (!selectedTask) {
      return { icon: "arrow", step: "Step 3 of 3", text: `Measured ${toArchitecturalString(measuredDistDisplay)}. Now select a task from the sidebar and click "Assign" to save it.` };
    }
    return { icon: "check", step: "Step 3 of 3", text: `Measured ${toArchitecturalString(measuredDistDisplay)}. Click "Assign" on the selected task to save, or re-measure by clicking two new points.` };
  }, [calibration, tool, showCalibDialog, calibPointCount, measurePointCount, measuredDistDisplay, selectedTask]);

  // ── Derived display state ──
  const isLoading = !imageUrl;
  const renderStatus = renderReq.data?.status;
  const renderFailed = renderStatus === "FAILED";

  const getProgressLabel = (): string => {
    if (renderFailed) return "Render failed. Try again.";
    if (!renderId) return "Requesting render...";
    if (renderStatus === "DONE") return "Loading image...";
    if (renderStatus === "PENDING") return "Queued — waiting for worker...";
    return "Rendering page...";
  };
  const progressLabel = getProgressLabel();

  const getProgressWidth = (): string => {
    if (!renderId) return "10%";
    if (renderStatus === "PENDING") return "30%";
    return "70%";
  };

  // ══════════════════════════ JSX ══════════════════════════
  return (
    <div className="flex h-[calc(100vh-7.5rem)] gap-0">
      {/* ── Toolbar ── */}
      <div className="flex w-12 flex-col items-center gap-1 border-r border-border bg-card py-2">
        {([
          { mode: "pan" as ToolMode, icon: Move, label: "Pan / Move — Drag to scroll around the drawing" },
          { mode: "calibrate" as ToolMode, icon: Crosshair, label: "Calibrate — Click two points on a known dimension to set the scale" },
          { mode: "measure" as ToolMode, icon: Ruler, label: "Measure — Click two points to measure a distance (calibrate first)" },
        ]).map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            title={label}
            onClick={() => {
              setTool(mode);
              if (mode === "calibrate") {
                calibPointsRef.current = [];
                setCalibPointCount(0);
                setShowCalibDialog(false);
                scheduleDraw();
              }
              if (mode === "measure") {
                measurePointsRef.current = [];
                setMeasurePointCount(0);
                measuredDistRef.current = null;
                setMeasuredDistDisplay(null);
                scheduleDraw();
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
        <button title="Zoom in (+)" onClick={handleZoomIn} className="rounded p-2 hover:bg-muted">
          <ZoomIn size={18} />
        </button>
        <button title="Zoom out (-)" onClick={handleZoomOut} className="rounded p-2 hover:bg-muted">
          <ZoomOut size={18} />
        </button>
        <div className="my-1 w-6 border-t border-border" />
        <button title="Reset view (R)" onClick={handleResetView} className="rounded p-2 hover:bg-muted">
          <RotateCcw size={18} />
        </button>
        <button title="Re-render in HD (higher quality, takes longer)" onClick={handleReRenderHD} className="rounded p-2 hover:bg-muted">
          <MonitorUp size={18} />
        </button>
      </div>

      {/* ── Canvas area ── */}
      <div className="relative flex-1 overflow-hidden bg-gray-100">
        {/* Contextual hint bar */}
        {!isLoading && (
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 bg-blue-50/95 border-b border-blue-200 px-4 py-2 text-sm backdrop-blur-sm">
            {contextHint.icon === "info" && <Info size={16} className="shrink-0 text-blue-500" />}
            {contextHint.icon === "arrow" && <ArrowRight size={16} className="shrink-0 text-amber-500" />}
            {contextHint.icon === "check" && <CheckCircle2 size={16} className="shrink-0 text-green-500" />}
            {contextHint.step && (
              <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                {contextHint.step}
              </span>
            )}
            <span className="text-blue-900">{contextHint.text}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            {renderFailed ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <span className="text-destructive text-lg">!</span>
                </div>
                <span className="text-sm font-medium text-destructive">{progressLabel}</span>
                <button
                  onClick={handleReRenderHD}
                  className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Retry Render
                </button>
              </div>
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="flex flex-col items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{progressLabel}</span>
                  <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full animate-pulse rounded-full bg-primary/60 transition-all duration-500"
                      style={{ width: getProgressWidth() }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {renderStatus === "PENDING"
                      ? "The worker will render this page shortly. High-DPI renders take a few seconds."
                      : "This usually takes 2-5 seconds per page."}
                  </span>
                </div>
              </>
            )}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className={cn(
              "h-full w-full",
              tool === "pan" && "cursor-grab",
              tool === "calibrate" && "cursor-crosshair",
              tool === "measure" && "cursor-crosshair",
            )}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        )}

        {/* Calibration dialog (draggable) */}
        {showCalibDialog && (
          <div
            className={cn(
              "z-10 rounded-lg border border-border bg-card p-6 shadow-xl w-[340px] select-none",
              calibDialogPos ? "fixed" : "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            )}
            style={calibDialogPos ? { left: calibDialogPos.x, top: calibDialogPos.y } : undefined}
            onMouseDown={handleDialogDragStart}
          >
            <h3 className="mb-1 font-semibold cursor-move">Calibrate Scale</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              You drew a reference line on the drawing. Enter the real-world length of that line so the tool can calculate the scale.
            </p>

            {/* Mode toggle */}
            <div className="mb-3 flex rounded-md border border-border overflow-hidden text-xs">
              <button
                onClick={() => setCalibMode("combo")}
                className={cn("flex-1 px-3 py-1.5 font-medium transition-colors", calibMode === "combo" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                Feet + Inches
              </button>
              <button
                onClick={() => setCalibMode("inches")}
                className={cn("flex-1 px-3 py-1.5 font-medium transition-colors", calibMode === "inches" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                Inches only
              </button>
            </div>

            {calibMode === "combo" ? (
              <div className="flex gap-2">
                <div className="w-20">
                  <label htmlFor="calib-feet" className="mb-1 block text-xs font-medium text-muted-foreground">Feet</label>
                  <input
                    id="calib-feet"
                    type="number"
                    min="0"
                    step="1"
                    value={calibFeet}
                    onChange={(e) => setCalibFeet(e.target.value)}
                    placeholder="142"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && finishCalibration()}
                  />
                </div>
                <div className="w-16">
                  <label htmlFor="calib-inches" className="mb-1 block text-xs font-medium text-muted-foreground">Inches</label>
                  <input
                    id="calib-inches"
                    type="number"
                    min="0"
                    max="11"
                    step="1"
                    value={calibInches}
                    onChange={(e) => setCalibInches(e.target.value)}
                    placeholder="5"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onKeyDown={(e) => e.key === "Enter" && finishCalibration()}
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="calib-fraction" className="mb-1 block text-xs font-medium text-muted-foreground">Fraction</label>
                  <select
                    id="calib-fraction"
                    value={calibFraction}
                    onChange={(e) => setCalibFraction(Number(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {FRACTION_OPTIONS.map((opt) => (
                      <option key={opt.label} value={opt.value}>
                        {opt.label === "0" ? "—" : opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="calib-total" className="mb-1 block text-xs font-medium text-muted-foreground">Total inches</label>
                <input
                  id="calib-total"
                  type="number"
                  step="0.01"
                  value={calibInput}
                  onChange={(e) => setCalibInput(e.target.value)}
                  placeholder='e.g., 84 (for 7 feet)'
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && finishCalibration()}
                />
              </div>
            )}

            {(() => {
              const total = getCalibValueInches();
              return total ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  = <strong>{total.toFixed(4)}"</strong> ({toArchitecturalString(total)})
                </p>
              ) : null;
            })()}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setShowCalibDialog(false); calibPointsRef.current = []; setCalibPointCount(0); setCalibFeet(""); setCalibInches(""); setCalibFraction(0); setCalibInput(""); scheduleDraw(); }}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={finishCalibration}
                disabled={!getCalibValueInches()}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Set Scale
              </button>
            </div>
          </div>
        )}

        {!isLoading && (
          <div
            className="absolute bottom-8 right-3 z-10 rounded-lg border border-border/60 shadow-lg overflow-hidden bg-black/50 backdrop-blur-sm"
            style={{ width: minimapSize.w, height: minimapSize.h }}
          >
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between">
              <button
                type="button"
                className="h-6 w-6 cursor-nw-resize flex items-center justify-center rounded-br-md bg-blue-600/80 hover:bg-blue-500 border-0 p-0 transition-colors"
                onMouseDown={handleMinimapResizeStart}
                title="Drag to resize minimap"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" className="text-white">
                  <path d="M0 10L10 0M0 6L6 0M0 2L2 0" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
              <button
                type="button"
                className="h-6 w-6 flex items-center justify-center rounded-bl-md bg-blue-600/80 hover:bg-blue-500 border-0 p-0 transition-colors"
                onClick={handleResetView}
                title="Reset view (R)"
              >
                <RotateCcw size={12} className="text-white" />
              </button>
            </div>
            <canvas
              ref={minimapRef}
              width={minimapSize.w}
              height={minimapSize.h}
              className="block cursor-crosshair"
              style={{ width: minimapSize.w, height: minimapSize.h }}
              onMouseDown={handleMinimapMouseDown}
              onMouseMove={handleMinimapMouseMove}
              onMouseUp={handleMinimapMouseUp}
              onMouseLeave={handleMinimapMouseUp}
            />
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-card/90 border-t border-border px-4 py-1.5 text-xs backdrop-blur">
          <span>Page {pageNum} | Zoom: {(zoomDisplay * 100).toFixed(0)}%</span>
          <div className="flex items-center gap-4">
            {calibration ? (
              <span className="group relative flex items-center gap-1 text-green-600 font-medium cursor-default">
                <CheckCircle2 size={13} />
                Scale calibrated
                <span className="pointer-events-none absolute bottom-full right-0 mb-1 hidden whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] text-white shadow-lg group-hover:block">
                  {calibration.pixelsPerUnit.toFixed(1)} px/in — Reference: {toArchitecturalString(calibration.realValue)}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-500 font-medium">
                <Info size={13} />
                Not calibrated
              </span>
            )}
            {measuredDistDisplay != null && (
              <span className="font-semibold text-blue-600">
                {measuredDistDisplay.toFixed(2)}" ({toArchitecturalString(measuredDistDisplay)})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Task sidebar ── */}
      <div className="w-64 overflow-y-auto border-l border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Measurement Tasks</h3>

        {pendingPageTasks.length > 0 && (
          <button
            type="button"
            onClick={() => setSkipDialogTarget("page")}
            className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors"
          >
            <Ban size={13} />
            Skip all {pendingPageTasks.length} tasks on this page
          </button>
        )}

        {pageTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tasks for this page.</p>
        ) : (
          <div className="space-y-2">
            {pageTasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "rounded-md border p-3 text-xs transition-colors",
                  task.status === "PENDING" && "border-orange-200 bg-orange-50",
                  task.status === "SKIPPED" && "border-gray-300 bg-gray-50 opacity-60",
                  task.status !== "PENDING" && task.status !== "SKIPPED" && "border-border bg-muted/30 opacity-60",
                  selectedTask === task.id && "ring-2 ring-primary",
                )}
              >
                <button
                  type="button"
                  className="w-full text-left cursor-pointer"
                  onClick={() => setSelectedTask(task.id)}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{task.dimensionKey}</span>
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      task.status === "PENDING" && "bg-orange-200 text-orange-800",
                      task.status === "SKIPPED" && "bg-gray-200 text-gray-700",
                      task.status === "COMPLETED" && "bg-green-200 text-green-800",
                    )}>
                      {task.status}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">Item: {task.itemId}</p>
                  {task.measuredValue != null && (
                    <p className="mt-1 font-medium">{toArchitecturalString(task.measuredValue)}</p>
                  )}
                </button>

                {task.status === "PENDING" && (
                  <div className="mt-2 flex gap-1">
                    {measuredDistDisplay != null && selectedTask === task.id && (
                      <button
                        onClick={() => assignToTask(task.id)}
                        disabled={completeMeasurement.isPending}
                        className="flex-1 rounded bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        Assign {toArchitecturalString(measuredDistDisplay)}
                      </button>
                    )}
                    <button
                      onClick={() => { setSkipTaskId(task.id); setSkipDialogTarget("single"); }}
                      className="flex items-center gap-0.5 rounded border border-gray-300 bg-white px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-50"
                      title="Skip this task"
                    >
                      <SkipForward size={10} />
                      Skip
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 border-t border-border pt-3">
          <h4 className="mb-2 text-xs font-semibold text-foreground">How to use</h4>
          <div className="space-y-2 text-[11px] text-muted-foreground">
            <div className="flex gap-2">
              <span className={cn("shrink-0 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white", calibration ? "bg-green-500" : "bg-blue-500")}>1</span>
              <div><strong>Calibrate:</strong> Find a dimension on the drawing with a known length (e.g., 7'-0"). Click both ends of that dimension line, then enter the real measurement.</div>
            </div>
            {(() => {
              let stepColor = "bg-gray-300";
              if (calibration && measuredDistDisplay == null) stepColor = "bg-blue-500";
              else if (calibration) stepColor = "bg-green-500";
              return (
                <div className="flex gap-2">
                  <span className={cn("shrink-0 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white", stepColor)}>2</span>
                  <div><strong>Measure:</strong> Click two endpoints on the element you need to measure. The distance appears on screen.</div>
                </div>
              );
            })()}
            <div className="flex gap-2">
              <span className={cn("shrink-0 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white", measuredDistDisplay == null ? "bg-gray-300" : "bg-blue-500")}>3</span>
              <div><strong>Assign:</strong> Select a task from the list above, then click "Assign" to save the measurement.</div>
            </div>
          </div>
          <div className="mt-3 border-t border-border pt-2">
            <h5 className="mb-1 text-[10px] font-semibold text-muted-foreground">Tips</h5>
            <ul className="space-y-0.5 text-[10px] text-muted-foreground">
              <li>Use <strong>scroll wheel</strong> to zoom in/out</li>
              <li>Zoom in close before clicking for better accuracy</li>
              <li>Press <strong>R</strong> to reset the view</li>
              <li>You can skip tasks that don't apply to this page</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Skip reason dialogs ── */}
      {skipDialogTarget === "single" && skipTaskId && (
        <SkipReasonDialog
          title="Skip Measurement Task"
          description="This task will be marked as skipped and won't block the pricing submission."
          isPending={skipTask.isPending}
          onCancel={() => { setSkipDialogTarget(null); setSkipTaskId(null); }}
          onConfirm={(reason) => {
            skipTask.mutate(
              { id: skipTaskId, reason },
              { onSuccess: () => { setSkipDialogTarget(null); setSkipTaskId(null); } },
            );
          }}
        />
      )}
      {skipDialogTarget === "page" && (
        <SkipReasonDialog
          title={`Skip All Tasks on Page ${pageNum}`}
          description={`This will skip ${pendingPageTasks.length} pending task${pendingPageTasks.length === 1 ? "" : "s"} on this page. They won't block pricing submission.`}
          isPending={bulkSkip.isPending}
          onCancel={() => setSkipDialogTarget(null)}
          onConfirm={(reason) => {
            bulkSkip.mutate(
              { taskIds: pendingPageTasks.map((t) => t.id), reason },
              { onSuccess: () => setSkipDialogTarget(null) },
            );
          }}
        />
      )}
    </div>
  );
}
