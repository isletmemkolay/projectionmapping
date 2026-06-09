import { useEffect, useRef } from "react";
import { Plus, Clock } from "lucide-react";
import { useStore } from "@/lib/store";

const SCENE_COLORS = [
  "from-cyan-500/30 to-cyan-500/5",
  "from-fuchsia-500/30 to-fuchsia-500/5",
  "from-emerald-500/30 to-emerald-500/5",
  "from-amber-500/30 to-amber-500/5",
  "from-violet-500/30 to-violet-500/5",
  "from-rose-500/30 to-rose-500/5",
];

export function Timeline() {
  const scenes = useStore((s) => s.scenes);
  const activeSceneId = useStore((s) => s.activeSceneId);
  const setActiveScene = useStore((s) => s.setActiveScene);
  const addScene = useStore((s) => s.addScene);
  const setSceneDuration = useStore((s) => s.setSceneDuration);
  const playing = useStore((s) => s.playing);

  // Auto-advance: when playing, advance to the next scene after the active
  // scene's duration.
  const elapsedRef = useRef(0);
  useEffect(() => {
    if (!playing) return;
    elapsedRef.current = 0;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const st = useStore.getState();
      const scene = st.scenes.find((s) => s.id === st.activeSceneId);
      if (scene) {
        elapsedRef.current += dt;
        if (elapsedRef.current >= scene.duration) {
          elapsedRef.current = 0;
          const idx = st.scenes.findIndex((s) => s.id === st.activeSceneId);
          st.setActiveScene(st.scenes[(idx + 1) % st.scenes.length].id);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  return (
    <div className="flex h-32 shrink-0 flex-col border-t border-border bg-sidebar">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Zaman Çizelgesi — Sahneler
        </span>
        <button
          onClick={addScene}
          data-testid="button-timeline-add-scene"
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10"
        >
          <Plus className="h-3.5 w-3.5" /> Sahne
        </button>
      </div>
      <div className="flex flex-1 items-stretch gap-2 overflow-x-auto p-3">
        {scenes.map((scene, i) => {
          const active = scene.id === activeSceneId;
          return (
            <div
              key={scene.id}
              onClick={() => setActiveScene(scene.id)}
              data-testid={`timeline-scene-${scene.id}`}
              className={`group relative flex h-full w-40 shrink-0 cursor-pointer flex-col justify-between overflow-hidden rounded-md border bg-gradient-to-br p-2 transition-all ${
                SCENE_COLORS[i % SCENE_COLORS.length]
              } ${active ? "border-primary ring-1 ring-primary/50" : "border-border hover:border-primary/40"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-foreground/70">#{i + 1}</span>
                <span className="rounded bg-black/30 px-1 font-mono text-[10px] text-foreground/70">
                  {scene.layers.length} kat.
                </span>
              </div>
              <div className="space-y-1">
                <div className="truncate text-xs font-semibold text-foreground">{scene.name}</div>
                <div className="flex items-center gap-1.5 text-[10px] text-foreground/60">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span className="flex items-baseline gap-0.5 font-mono">
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={scene.duration}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setSceneDuration(scene.id, Math.max(1, Number(e.target.value) || 1))}
                      data-testid={`input-duration-${scene.id}`}
                      className="w-6 bg-transparent text-right tabular-nums outline-none focus:text-primary"
                    />
                    <span>sn</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
