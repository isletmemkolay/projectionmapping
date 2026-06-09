import { Plus, Trash2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export function ScenesPanel() {
  const scenes = useStore((s) => s.scenes);
  const activeSceneId = useStore((s) => s.activeSceneId);
  const addScene = useStore((s) => s.addScene);
  const removeScene = useStore((s) => s.removeScene);
  const setActiveScene = useStore((s) => s.setActiveScene);
  const renameScene = useStore((s) => s.renameScene);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Sahneler
        </span>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={addScene} data-testid="button-add-scene">
          <Plus className="h-3.5 w-3.5" /> Ekle
        </Button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {scenes.map((scene, i) => {
          const active = scene.id === activeSceneId;
          return (
            <div
              key={scene.id}
              onClick={() => setActiveScene(scene.id)}
              data-testid={`scene-row-${scene.id}`}
              className={`group flex items-center gap-2 rounded-md border px-2 py-2 text-xs transition-colors ${
                active ? "border-primary/60 bg-primary/10" : "border-transparent hover:border-border hover:bg-card"
              }`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-[10px] ${active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {i + 1}
              </span>
              <input
                value={scene.name}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => renameScene(scene.id, e.target.value)}
                data-testid={`input-scene-name-${scene.id}`}
                className="flex-1 truncate bg-transparent font-medium outline-none focus:text-primary"
              />
              <Layers className="h-3 w-3 text-muted-foreground/40" />
              <span className="font-mono text-[10px] text-muted-foreground">{scene.layers.length}</span>
              {scenes.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeScene(scene.id);
                  }}
                  data-testid={`button-delete-scene-${scene.id}`}
                  className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
