import { useRef, useState } from "react";
import {
  Plus,
  Video,
  Image as ImageIcon,
  Camera,
  MonitorUp,
  Sparkles,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStore, getActiveScene, type LayerType, type Layer } from "@/lib/store";
import { createVideoElement } from "@/lib/media/video-source";
import { createCameraSource } from "@/lib/media/camera-source";
import { createScreenSource } from "@/lib/media/screen-source";
import { rendererRef } from "./CanvasView";
import { useToast } from "@/hooks/use-toast";

const TYPE_ICON: Record<LayerType, React.ReactNode> = {
  video: <Video className="h-3.5 w-3.5" />,
  image: <ImageIcon className="h-3.5 w-3.5" />,
  camera: <Camera className="h-3.5 w-3.5" />,
  screen: <MonitorUp className="h-3.5 w-3.5" />,
  shader: <Sparkles className="h-3.5 w-3.5" />,
};

export function LayersPanel() {
  const { toast } = useToast();
  const scene = useStore((s) => getActiveScene(s));
  const selectedId = useStore((s) => s.selectedLayerId);
  const addLayer = useStore((s) => s.addLayer);
  const removeLayer = useStore((s) => s.removeLayer);
  const selectLayer = useStore((s) => s.selectLayer);
  const toggleVisible = useStore((s) => s.toggleVisible);
  const toggleLocked = useStore((s) => s.toggleLocked);
  const reorderLayer = useStore((s) => s.reorderLayer);
  const updateLayer = useStore((s) => s.updateLayer);

  const videoInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const bindStreamLayer = async (type: "camera" | "screen") => {
    try {
      const video = type === "camera" ? await createCameraSource() : await createScreenSource();
      const id = addLayer(type);
      rendererRef.current?.setVideoSource(id, video, false);
    } catch (e: any) {
      toast({ title: "Kaynak hatası", description: String(e.message || e), variant: "destructive" });
    }
  };

  const onAdd = (type: LayerType) => {
    if (type === "video") videoInput.current?.click();
    else if (type === "image") imageInput.current?.click();
    else if (type === "camera") bindStreamLayer("camera");
    else if (type === "screen") bindStreamLayer("screen");
    else if (type === "shader") {
      const id = addLayer("shader");
      const layer = getActiveScene(useStore.getState())?.layers.find((l) => l.id === id);
      if (layer?.shaderBody) rendererRef.current?.setShaderSource(id, layer.shaderBody);
    }
  };

  const onVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const video = createVideoElement(url);
    const id = addLayer("video", f.name.replace(/\.[^.]+$/, ""));
    updateLayer(id, { sourceName: f.name });
    rendererRef.current?.setVideoSource(id, video, false);
    e.target.value = "";
  };

  const onImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const id = addLayer("image", f.name.replace(/\.[^.]+$/, ""));
      updateLayer(id, { sourceName: f.name });
      rendererRef.current?.setImageSource(id, img);
    };
    img.src = url;
    e.target.value = "";
  };

  const onDrop = (to: number) => {
    if (dragIdx.current === null) return;
    reorderLayer(dragIdx.current, to);
    dragIdx.current = null;
    setDragOver(null);
  };

  const layers = scene?.layers ?? [];
  // Display top-to-bottom = topmost layer first (drawn last). Render reversed.
  const ordered = [...layers].map((l, i) => ({ l, i })).reverse();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Katmanlar
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" data-testid="button-add-layer">
              <Plus className="h-3.5 w-3.5" /> Ekle
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onAdd("video")} data-testid="menu-add-video">
              <Video className="mr-2 h-4 w-4" /> Video
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAdd("image")} data-testid="menu-add-image">
              <ImageIcon className="mr-2 h-4 w-4" /> Görsel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAdd("camera")} data-testid="menu-add-camera">
              <Camera className="mr-2 h-4 w-4" /> Kamera
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAdd("screen")} data-testid="menu-add-screen">
              <MonitorUp className="mr-2 h-4 w-4" /> Ekran
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAdd("shader")} data-testid="menu-add-shader">
              <Sparkles className="mr-2 h-4 w-4" /> Shader
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {ordered.length === 0 && (
          <div className="mt-10 px-4 text-center text-xs text-muted-foreground">
            Henüz katman yok. Yukarıdaki <span className="text-primary">Ekle</span> ile bir kaynak ekleyin.
          </div>
        )}
        <div className="space-y-1">
          {ordered.map(({ l, i }) => (
            <LayerRow
              key={l.id}
              layer={l}
              selected={l.id === selectedId}
              dragOver={dragOver === i}
              onSelect={() => selectLayer(l.id)}
              onToggleVis={() => toggleVisible(l.id)}
              onToggleLock={() => toggleLocked(l.id)}
              onDelete={() => {
                rendererRef.current?.disposeSource(l.id);
                removeLayer(l.id);
              }}
              onDragStart={() => (dragIdx.current = i)}
              onDragEnter={() => setDragOver(i)}
              onDrop={() => onDrop(i)}
              icon={TYPE_ICON[l.type]}
            />
          ))}
        </div>
      </div>

      <input ref={videoInput} type="file" accept="video/mp4,video/webm,video/*" className="hidden" onChange={onVideoFile} />
      <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/gif,image/*" className="hidden" onChange={onImageFile} />
    </div>
  );
}

function LayerRow({
  layer,
  selected,
  dragOver,
  onSelect,
  onToggleVis,
  onToggleLock,
  onDelete,
  onDragStart,
  onDragEnter,
  onDrop,
  icon,
}: {
  layer: Layer;
  selected: boolean;
  dragOver: boolean;
  onSelect: () => void;
  onToggleVis: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDrop: () => void;
  icon: React.ReactNode;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={onSelect}
      data-testid={`layer-row-${layer.id}`}
      className={`group flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors ${
        selected
          ? "border-primary/60 bg-primary/10"
          : "border-transparent hover:border-border hover:bg-card"
      } ${dragOver ? "border-primary/40" : ""} ${layer.visible ? "" : "opacity-50"}`}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/50" />
      <span className={`shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`}>{icon}</span>
      <span className="flex-1 truncate font-medium">{layer.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleVis();
        }}
        data-testid={`button-visible-${layer.id}`}
        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
      >
        {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock();
        }}
        data-testid={`button-lock-${layer.id}`}
        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
      >
        {layer.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        data-testid={`button-delete-${layer.id}`}
        className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
