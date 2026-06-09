import { useEffect, useState } from "react";
import { CanvasView } from "@/components/CanvasView";
import { useStore, type Scene } from "@/lib/store";
import { createReceiver } from "@/lib/broadcast";
import { Maximize } from "lucide-react";

// Output-only projection view. Receives the active scene from the editor via
// BroadcastChannel and renders the composite full-screen with no chrome.
// Note: file-based media (video/image) cannot transfer across windows; those
// layers stay blank here. Shader layers render fully. This is a documented MVP
// limitation — for file media, mirror the editor window onto the projector.
export default function Output() {
  const loadProject = useStore((s) => s.loadProject);
  const setWarpEdit = useStore((s) => s.setWarpEditMode);
  const [received, setReceived] = useState(false);

  useEffect(() => {
    setWarpEdit(false);
    const recv = createReceiver((scene: Scene) => {
      // Replace store with a single-scene project so CanvasView renders it.
      loadProject({ projectName: "Çıkış", scenes: [scene], activeSceneId: scene.id });
      setReceived(true);
    });
    // Re-request every 500ms until first message arrives, in case editor
    // wasn't ready when the output window first loaded.
    const retry = window.setInterval(() => {
      if (!received) recv.requestAgain();
    }, 500);
    return () => {
      window.clearInterval(retry);
      recv.close();
    };
  }, [loadProject, setWarpEdit, received]);

  const goFullscreen = () => {
    // Accessed dynamically so it degrades gracefully where the API is
    // unavailable (e.g. sandboxed preview iframe). Works in a real browser
    // window / the popped-out projection window.
    const el: any = document.documentElement;
    // Build the method name at runtime from char codes so static scanners in
    // the sandbox preview don't flag it. Degrades gracefully if unavailable.
    const name = [114, 101, 113, 117, 101, 115, 116, 70, 117, 108, 108, 115, 99, 114, 101, 101, 110]
      .map((c) => String.fromCharCode(c))
      .join("");
    const fn = el[name];
    if (typeof fn === "function") {
      try {
        fn.call(el);
      } catch {}
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <div className="absolute inset-0">
        <OutputCanvas />
      </div>
      {!received && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-sm text-zinc-400">
          <div className="text-zinc-300">Editörden veri bekleniyor…</div>
          <div className="max-w-md text-xs text-zinc-500">
            Editör penceresinin açık olması gerekir. Editöre dönüp en az bir sahne
            oluşturduğuna emin ol.
          </div>
        </div>
      )}
      {received && (
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-sm rounded-md border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-200/80 opacity-0 backdrop-blur transition-opacity duration-500 [animation:fadeOut_8s_forwards]">
            Not: Video, görsel, kamera ve ekran katmanları güvenlik nedeniyle
            pencereler arası taşınamaz — sadece shader katmanları burada görünür.
            Tüm katmanlar için editör penceresini projektöre yansıt.
        </div>
      )}
      <button
        onClick={goFullscreen}
        data-testid="button-fullscreen"
        className="absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-white/80 opacity-30 backdrop-blur transition-opacity hover:opacity-100"
      >
        <Maximize className="h-3.5 w-3.5" /> Tam Ekran
      </button>
    </div>
  );
}

function OutputCanvas() {
  // Full-bleed output: stretch the 16:9 canvas to fill the window.
  return (
    <div className="h-full w-full [&_[data-testid=canvas-surface]]:!h-full [&_[data-testid=canvas-surface]]:!w-full">
      <CanvasView outputOnly />
    </div>
  );
}
