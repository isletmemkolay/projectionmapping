import { useRef } from "react";
import {
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Square,
  ZoomIn,
  ZoomOut,
  Monitor,
  Save,
  FolderOpen,
  Grid3x3,
  Frame,
  Eye,
  EyeOff,
} from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useStore, getActiveScene } from "@/lib/store";
import { downloadProject, parseProjectFile } from "@/lib/project-io";
import { useToast } from "@/hooks/use-toast";

function TBtn({
  label,
  onClick,
  active,
  children,
  testId,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClick}
          data-testid={testId}
          className={`h-8 w-8 ${active ? "bg-primary/15 text-primary" : "text-foreground/80"}`}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function Toolbar() {
  const fileInput = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const projectName = useStore((s) => s.projectName);
  const setProjectName = useStore((s) => s.setProjectName);
  const scenes = useStore((s) => s.scenes);
  const activeSceneId = useStore((s) => s.activeSceneId);
  const setActiveScene = useStore((s) => s.setActiveScene);
  const playing = useStore((s) => s.playing);
  const setPlaying = useStore((s) => s.setPlaying);
  const zoom = useStore((s) => s.zoom);
  const setZoom = useStore((s) => s.setZoom);
  const warpEdit = useStore((s) => s.warpEditMode);
  const setWarpEdit = useStore((s) => s.setWarpEditMode);
  const loadProject = useStore((s) => s.loadProject);
  const selectedId = useStore((s) => s.selectedLayerId);
  const setWarpMode = useStore((s) => s.setWarpMode);
  const scene = getActiveScene(useStore.getState());
  const selectedLayer = scene?.layers.find((l) => l.id === selectedId);

  const idx = scenes.findIndex((s) => s.id === activeSceneId);

  const prevScene = () => setActiveScene(scenes[(idx - 1 + scenes.length) % scenes.length].id);
  const nextScene = () => setActiveScene(scenes[(idx + 1) % scenes.length].id);

  const openProjection = () => {
    window.open(`${window.location.origin}${window.location.pathname}#/output`, "pmap-output", "width=1280,height=720");
    toast({ title: "Projeksiyon penceresi açıldı", description: "Yeni pencereyi projektöre taşıyın ve tam ekran yapın." });
  };

  const onSave = () => {
    downloadProject(useStore.getState());
    toast({ title: "Proje kaydedildi", description: "Medya dosyaları kaydedilmez; yüklemede tekrar ekleyin." });
  };

  const onLoadClick = () => fileInput.current?.click();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = await parseProjectFile(f);
      loadProject(data);
      toast({ title: "Proje yüklendi", description: "Medya kaynaklarını yeniden ekleyin." });
    } catch (err: any) {
      toast({ title: "Yükleme hatası", description: String(err.message || err), variant: "destructive" });
    }
    e.target.value = "";
  };

  return (
    <div className="flex h-12 items-center gap-1 border-b border-border bg-sidebar px-3">
      <div className="flex items-center gap-2 pr-2">
        <span className="text-primary">
          <Logo size={22} />
        </span>
        <span className="select-none text-sm font-semibold tracking-tight">Projeksiyon Mapper</span>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <input
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        data-testid="input-project-name"
        className="w-44 rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-muted-foreground outline-none transition-colors hover:border-border focus:border-primary focus:text-foreground"
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <TBtn label="Önceki sahne" onClick={prevScene} testId="button-prev-scene">
        <SkipBack className="h-4 w-4" />
      </TBtn>
      <TBtn
        label={playing ? "Duraklat" : "Oynat"}
        onClick={() => setPlaying(!playing)}
        active={playing}
        testId="button-play"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </TBtn>
      <TBtn label="Durdur" onClick={() => setPlaying(false)} testId="button-stop">
        <Square className="h-4 w-4" />
      </TBtn>
      <TBtn label="Sonraki sahne" onClick={nextScene} testId="button-next-scene">
        <SkipForward className="h-4 w-4" />
      </TBtn>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* warp mode toggle for selected layer */}
      <TBtn
        label="Köşe (Quad) warp"
        onClick={() => selectedLayer && setWarpMode(selectedLayer.id, "quad")}
        active={selectedLayer?.warpMode === "quad"}
        testId="button-warp-quad"
      >
        <Frame className="h-4 w-4" />
      </TBtn>
      <TBtn
        label="Ağ (Mesh) warp"
        onClick={() => selectedLayer && setWarpMode(selectedLayer.id, "mesh")}
        active={selectedLayer?.warpMode === "mesh"}
        testId="button-warp-mesh"
      >
        <Grid3x3 className="h-4 w-4" />
      </TBtn>
      <TBtn
        label={warpEdit ? "Tutamaçları gizle" : "Tutamaçları göster"}
        onClick={() => setWarpEdit(!warpEdit)}
        active={warpEdit}
        testId="button-toggle-handles"
      >
        {warpEdit ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </TBtn>

      <div className="flex-1" />

      <span className="w-12 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <TBtn label="Uzaklaştır" onClick={() => setZoom(zoom - 0.1)} testId="button-zoom-out">
        <ZoomOut className="h-4 w-4" />
      </TBtn>
      <TBtn label="Yakınlaştır" onClick={() => setZoom(zoom + 0.1)} testId="button-zoom-in">
        <ZoomIn className="h-4 w-4" />
      </TBtn>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button
        size="sm"
        variant="ghost"
        onClick={openProjection}
        data-testid="button-projection-mode"
        className="h-8 gap-1.5 text-xs text-primary hover:bg-primary/10"
      >
        <Monitor className="h-4 w-4" />
        Projeksiyon Modu
      </Button>

      <TBtn label="Projeyi kaydet" onClick={onSave} testId="button-save">
        <Save className="h-4 w-4" />
      </TBtn>
      <TBtn label="Proje aç" onClick={onLoadClick} testId="button-load">
        <FolderOpen className="h-4 w-4" />
      </TBtn>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}
