import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore, getActiveScene, type Layer } from "@/lib/store";
import { BLEND_MODES, BLEND_LABELS_TR, type BlendMode } from "@/lib/webgl/blend-modes";
import { SHADER_PRESETS } from "@/lib/webgl/shaders";
import { generateGrid } from "@/lib/webgl/mesh";
import { rendererRef } from "./CanvasView";
import { useToast } from "@/hooks/use-toast";
import { RotateCcw, Play } from "lucide-react";

function Field({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
        {value !== undefined && (
          <span className="font-mono text-[11px] tabular-nums text-foreground">{value}</span>
        )}
      </div>
      {children}
    </div>
  );
}

export function RightSidebar() {
  const selectedId = useStore((s) => s.selectedLayerId);
  const scene = useStore((s) => getActiveScene(s));
  const layer = scene?.layers.find((l) => l.id === selectedId);

  if (!layer) {
    return (
      <div className="flex w-80 shrink-0 flex-col border-l border-border bg-sidebar">
        <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Özellikler
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
          Özelliklerini düzenlemek için bir katman seçin.
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-80 shrink-0 flex-col border-l border-border bg-sidebar">
      <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Özellikler — <span className="text-foreground normal-case">{layer.name}</span>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-3">
        <CommonProps layer={layer} />
        <WarpProps layer={layer} />
        <MaskProps layer={layer} />
        {layer.type === "shader" && <ShaderProps layer={layer} />}
      </div>
    </div>
  );
}

function CommonProps({ layer }: { layer: Layer }) {
  const updateLayer = useStore((s) => s.updateLayer);
  return (
    <div className="space-y-4">
      <Field label="Opaklık" value={`${Math.round(layer.opacity * 100)}%`}>
        <Slider
          value={[layer.opacity * 100]}
          min={0}
          max={100}
          step={1}
          onValueChange={([v]) => updateLayer(layer.id, { opacity: v / 100 })}
          data-testid="slider-opacity"
        />
      </Field>
      <Field label="Karışım Modu">
        <Select value={layer.blend} onValueChange={(v) => updateLayer(layer.id, { blend: v as BlendMode })}>
          <SelectTrigger className="h-8 text-xs" data-testid="select-blend">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLEND_MODES.map((m) => (
              <SelectItem key={m} value={m} className="text-xs">
                {BLEND_LABELS_TR[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function WarpProps({ layer }: { layer: Layer }) {
  const setWarpMode = useStore((s) => s.setWarpMode);
  const setMeshResolution = useStore((s) => s.setMeshResolution);
  const updateLayer = useStore((s) => s.updateLayer);
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <Field label="Warp Modu">
        <Select value={layer.warpMode} onValueChange={(v) => setWarpMode(layer.id, v as any)}>
          <SelectTrigger className="h-8 text-xs" data-testid="select-warp-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="quad" className="text-xs">Köşe (Quad)</SelectItem>
            <SelectItem value="mesh" className="text-xs">Ağ (Mesh)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {layer.warpMode === "mesh" && (
        <>
          <Field label="Ağ Çözünürlüğü" value={`${layer.meshCols} × ${layer.meshRows}`}>
            <Slider
              value={[layer.meshCols]}
              min={3}
              max={20}
              step={1}
              onValueChange={([v]) => setMeshResolution(layer.id, v, v)}
              data-testid="slider-mesh-res"
            />
          </Field>
        </>
      )}
      <Button
        size="sm"
        variant="outline"
        className="h-7 w-full gap-1.5 text-xs"
        data-testid="button-reset-warp"
        onClick={() => {
          if (layer.warpMode === "mesh") {
            updateLayer(layer.id, { meshPoints: generateGrid(layer.meshCols, layer.meshRows) });
          } else {
            updateLayer(layer.id, {
              quad: {
                tl: { x: 0.15, y: 0.15 },
                tr: { x: 0.85, y: 0.15 },
                br: { x: 0.85, y: 0.85 },
                bl: { x: 0.15, y: 0.85 },
              },
            });
          }
        }}
      >
        <RotateCcw className="h-3.5 w-3.5" /> Warp'ı Sıfırla
      </Button>
    </div>
  );
}

function MaskProps({ layer }: { layer: Layer }) {
  const updateLayer = useStore((s) => s.updateLayer);
  const m = layer.mask;
  const setMask = (patch: Partial<typeof m>) => updateLayer(layer.id, { mask: { ...m, ...patch } });
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Dikdörtgen Maske
        </Label>
        <Switch
          checked={layer.maskEnabled}
          onCheckedChange={(v) => updateLayer(layer.id, { maskEnabled: v })}
          data-testid="switch-mask"
        />
      </div>
      {layer.maskEnabled && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sol" value={m.x0.toFixed(2)}>
            <Slider value={[m.x0 * 100]} min={0} max={100} step={1} onValueChange={([v]) => setMask({ x0: v / 100 })} />
          </Field>
          <Field label="Üst" value={m.y0.toFixed(2)}>
            <Slider value={[m.y0 * 100]} min={0} max={100} step={1} onValueChange={([v]) => setMask({ y0: v / 100 })} />
          </Field>
          <Field label="Sağ" value={m.x1.toFixed(2)}>
            <Slider value={[m.x1 * 100]} min={0} max={100} step={1} onValueChange={([v]) => setMask({ x1: v / 100 })} />
          </Field>
          <Field label="Alt" value={m.y1.toFixed(2)}>
            <Slider value={[m.y1 * 100]} min={0} max={100} step={1} onValueChange={([v]) => setMask({ y1: v / 100 })} />
          </Field>
        </div>
      )}
    </div>
  );
}

function ShaderProps({ layer }: { layer: Layer }) {
  const updateLayer = useStore((s) => s.updateLayer);
  const { toast } = useToast();
  const [code, setCode] = useState(layer.shaderBody ?? "");

  const apply = () => {
    const err = rendererRef.current?.setShaderSource(layer.id, code);
    if (err) {
      toast({ title: "Shader derleme hatası", description: err, variant: "destructive" });
    } else {
      updateLayer(layer.id, { shaderBody: code });
      toast({ title: "Shader güncellendi" });
    }
  };

  const loadPreset = (key: string) => {
    const body = SHADER_PRESETS[key].body;
    setCode(body);
    updateLayer(layer.id, { shaderBody: body });
    rendererRef.current?.setShaderSource(layer.id, body);
  };

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <Field label="Shader Ön Ayarı">
        <Select onValueChange={loadPreset}>
          <SelectTrigger className="h-8 text-xs" data-testid="select-shader-preset">
            <SelectValue placeholder="Ön ayar seç…" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SHADER_PRESETS).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-xs">
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Fragment Kodu (vec3 render(vec2 uv))">
        <Textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          data-testid="textarea-shader"
          className="h-48 resize-none font-mono text-[11px] leading-relaxed"
        />
      </Field>
      <Button size="sm" className="h-7 w-full gap-1.5 text-xs" onClick={apply} data-testid="button-apply-shader">
        <Play className="h-3.5 w-3.5" /> Derle & Uygula
      </Button>
    </div>
  );
}
