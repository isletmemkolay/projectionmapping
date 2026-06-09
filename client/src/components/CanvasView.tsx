import { useEffect, useRef, useState } from "react";
import { Renderer } from "@/lib/webgl/renderer";
import { useStore, getActiveScene } from "@/lib/store";
import { WarpHandles } from "./WarpHandles";

export interface CanvasViewProps {
  outputOnly?: boolean;
  // expose renderer for source binding from panels
  onRenderer?: (r: Renderer) => void;
}

// Global ref so RightSidebar / LayersPanel can bind media sources to the renderer.
export const rendererRef: { current: Renderer | null } = { current: null };

export function CanvasView({ outputOnly = false, onRenderer }: CanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1280, h: 720 });
  const zoom = useStore((s) => s.zoom);
  const editMode = useStore((s) => s.warpEditMode);
  const selectedId = useStore((s) => s.selectedLayerId);
  const activeSceneId = useStore((s) => s.activeSceneId);
  const selectedLayer = useStore((s) =>
    getActiveScene(s)?.layers.find((l) => l.id === s.selectedLayerId)
  );

  // 16:9 canvas surface.
  const aspect = 16 / 9;

  useEffect(() => {
    if (!canvasRef.current) return;
    const r = new Renderer(
      canvasRef.current,
      () => getActiveScene(useStore.getState()),
      () => useStore.getState().warpEditMode,
      () => useStore.getState().selectedLayerId
    );
    r.showHandles = !outputOnly;
    rendererRef.current = r;
    onRenderer?.(r);
    r.start();
    return () => {
      r.dispose();
      if (rendererRef.current === r) rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputOnly]);

  // Re-bind media sources when switching scenes / on mount (for any layers that
  // already have runtime sources, they persist in the renderer map by id).
  useEffect(() => {
    // nothing to do here for now; sources are bound on upload.
  }, [activeSceneId]);

  // Resize observer -> compute fitted surface (16:9) inside the viewport.
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => {
      const el = wrapRef.current!;
      if (outputOnly) {
        // Full-bleed: fill the entire window.
        setSize({ w: Math.max(64, el.clientWidth), h: Math.max(36, el.clientHeight) });
        return;
      }
      const availW = el.clientWidth - 32;
      const availH = el.clientHeight - 32;
      let w = availW;
      let h = w / aspect;
      if (h > availH) {
        h = availH;
        w = h * aspect;
      }
      w *= zoom;
      h *= zoom;
      setSize({ w: Math.max(64, w), h: Math.max(36, h) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [zoom, aspect, outputOnly]);

  // Apply size to canvas backing store.
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    r.resize(size.w, size.h, dpr);
  }, [size]);

  return (
    <div ref={wrapRef} className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div
        className="relative shadow-2xl"
        style={{ width: size.w, height: size.h }}
        data-testid="canvas-surface"
      >
        {/* checkerboard backdrop to visualize transparency */}
        <div
          className="absolute inset-0 rounded-sm"
          style={{
            backgroundColor: "#0a0a0c",
            backgroundImage:
              "linear-gradient(45deg,#141418 25%,transparent 25%),linear-gradient(-45deg,#141418 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#141418 75%),linear-gradient(-45deg,transparent 75%,#141418 75%)",
            backgroundSize: "24px 24px",
            backgroundPosition: "0 0,0 12px,12px -12px,-12px 0",
          }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full rounded-sm ring-1 ring-border"
          style={{ width: size.w, height: size.h }}
        />
        {!outputOnly && editMode && selectedLayer && !selectedLayer.locked && (
          <WarpHandles layer={selectedLayer} width={size.w} height={size.h} />
        )}
      </div>
    </div>
  );
}
