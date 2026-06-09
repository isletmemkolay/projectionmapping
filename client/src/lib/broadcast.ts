// BroadcastChannel sync between editor and output window.
// Editor broadcasts the active scene; output requests latest on mount.
//
// Limitation: BroadcastChannel can transfer cloneable data only — Blob URLs,
// MediaStream, and HTMLVideoElement do NOT cross windows. Shader layers
// render fully in output; file/camera/screen layers need to be re-attached
// in the output window itself (future enhancement). For MVP we render what
// can be rendered and clearly inform the user.

import type { Scene } from "./store";

const CHANNEL = "pmap-sync";

export type SyncMessage =
  | { type: "scene"; scene: Scene }
  | { type: "request" };

export function createBroadcaster() {
  const bc = new BroadcastChannel(CHANNEL);
  return {
    sendScene(scene: Scene) {
      try {
        // Strip non-cloneable fields (e.g. media element references) before sending.
        const safe = sanitizeScene(scene);
        bc.postMessage({ type: "scene", scene: safe } as SyncMessage);
      } catch (err) {
        console.warn("[pmap] broadcast send failed", err);
      }
    },
    onRequest(cb: () => void) {
      bc.addEventListener("message", (e: MessageEvent<SyncMessage>) => {
        if (e.data?.type === "request") cb();
      });
    },
    close() {
      bc.close();
    },
  };
}

export function createReceiver(onScene: (scene: Scene) => void) {
  const bc = new BroadcastChannel(CHANNEL);
  bc.onmessage = (e: MessageEvent<SyncMessage>) => {
    if (e.data?.type === "scene") onScene(e.data.scene);
  };
  // Immediately ask the editor for current scene.
  try {
    bc.postMessage({ type: "request" } as SyncMessage);
  } catch {}
  return {
    requestAgain() {
      try {
        bc.postMessage({ type: "request" } as SyncMessage);
      } catch {}
    },
    close() {
      bc.close();
    },
  };
}

// Remove any properties that can't be structured-cloned (DOM elements,
// MediaStream, functions). Keep only data needed to reconstruct geometry.
function sanitizeScene(scene: Scene): Scene {
  return JSON.parse(
    JSON.stringify(scene, (_key, value) => {
      if (value instanceof HTMLElement) return undefined;
      if (typeof MediaStream !== "undefined" && value instanceof MediaStream) return undefined;
      if (typeof value === "function") return undefined;
      return value;
    })
  );
}
