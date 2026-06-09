import { useCallback, useRef } from "react";
import { useStore, type Layer, type QuadCorners } from "@/lib/store";

interface Props {
  layer: Layer;
  width: number;
  height: number;
}

// Renders absolutely-positioned draggable handles over the canvas surface.
// Positions are stored in normalized [0,1] space; we convert to pixels here.
export function WarpHandles({ layer, width, height }: Props) {
  if (layer.warpMode === "quad") {
    return <QuadHandles layer={layer} width={width} height={height} />;
  }
  return <MeshHandles layer={layer} width={width} height={height} />;
}

function useDrag(
  width: number,
  height: number,
  onMove: (nx: number, ny: number) => void
) {
  const dragging = useRef(false);
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragging.current = true;
    },
    []
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const parent = (e.currentTarget as HTMLElement).parentElement!;
      const rect = parent.getBoundingClientRect();
      const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      onMove(nx, ny);
    },
    [onMove]
  );
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, []);
  return { onPointerDown, onPointerMove, onPointerUp };
}

function Handle({
  x,
  y,
  width,
  height,
  onMove,
  testId,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  onMove: (nx: number, ny: number) => void;
  testId?: string;
}) {
  const drag = useDrag(width, height, onMove);
  return (
    <div
      {...drag}
      data-testid={testId}
      className="absolute z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-primary bg-primary/30 backdrop-blur-sm transition-transform active:scale-125 active:cursor-grabbing"
      style={{ left: x * width, top: y * height, touchAction: "none" }}
    />
  );
}

function QuadHandles({ layer, width, height }: Props) {
  const setQuadCorner = useStore((s) => s.setQuadCorner);
  const q = layer.quad;
  const corners: (keyof QuadCorners)[] = ["tl", "tr", "br", "bl"];
  // outline path
  const pts = corners.map((c) => `${q[c].x * width},${q[c].y * height}`).join(" ");
  return (
    <>
      <svg className="pointer-events-none absolute inset-0 z-10" width={width} height={height}>
        <polygon
          points={pts}
          fill="none"
          stroke="hsl(180 90% 55%)"
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.8}
        />
      </svg>
      {corners.map((c) => (
        <Handle
          key={c}
          x={q[c].x}
          y={q[c].y}
          width={width}
          height={height}
          testId={`handle-quad-${c}`}
          onMove={(nx, ny) => setQuadCorner(layer.id, c, nx, ny)}
        />
      ))}
    </>
  );
}

function MeshHandles({ layer, width, height }: Props) {
  const setMeshPoint = useStore((s) => s.setMeshPoint);
  return (
    <>
      {layer.meshPoints.map((p, i) => (
        <Handle
          key={i}
          x={p.x}
          y={p.y}
          width={width}
          height={height}
          testId={`handle-mesh-${i}`}
          onMove={(nx, ny) => setMeshPoint(layer.id, i, nx, ny)}
        />
      ))}
    </>
  );
}
