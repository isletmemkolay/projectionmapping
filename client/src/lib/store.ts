import { create } from "zustand";
import type { BlendMode } from "./webgl/blend-modes";
import { generateGrid, resampleGrid, type GridPoint } from "./webgl/mesh";
import { SHADER_PRESETS } from "./webgl/shaders";

export type LayerType = "video" | "image" | "camera" | "screen" | "shader";
export type WarpMode = "quad" | "mesh";

export interface QuadCorners {
  // normalized [0,1] destination corners, order TL,TR,BR,BL
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  br: { x: number; y: number };
  bl: { x: number; y: number };
}

export interface MaskRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  // Source descriptor — actual media handle lives in the renderer runtime map.
  sourceName?: string; // file name for serialization
  shaderBody?: string; // for shader layers
  warpMode: WarpMode;
  quad: QuadCorners;
  meshCols: number;
  meshRows: number;
  meshPoints: GridPoint[];
  blend: BlendMode;
  opacity: number;
  visible: boolean;
  locked: boolean;
  maskEnabled: boolean;
  mask: MaskRect;
}

export interface Scene {
  id: string;
  name: string;
  duration: number; // seconds for auto-advance
  layers: Layer[];
}

export interface ProjectState {
  projectName: string;
  scenes: Scene[];
  activeSceneId: string;
  selectedLayerId: string | null;
  warpEditMode: boolean; // show handles
  playing: boolean;
  zoom: number;

  // actions
  setProjectName: (n: string) => void;
  addScene: () => void;
  removeScene: (id: string) => void;
  renameScene: (id: string, name: string) => void;
  setSceneDuration: (id: string, d: number) => void;
  setActiveScene: (id: string) => void;
  reorderScene: (from: number, to: number) => void;

  addLayer: (type: LayerType, name?: string, shaderBody?: string) => string;
  removeLayer: (id: string) => void;
  selectLayer: (id: string | null) => void;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  renameLayer: (id: string, name: string) => void;
  reorderLayer: (from: number, to: number) => void;
  toggleVisible: (id: string) => void;
  toggleLocked: (id: string) => void;

  setQuadCorner: (id: string, corner: keyof QuadCorners, x: number, y: number) => void;
  setMeshPoint: (id: string, index: number, x: number, y: number) => void;
  setMeshResolution: (id: string, cols: number, rows: number) => void;
  setWarpMode: (id: string, mode: WarpMode) => void;
  setWarpEditMode: (v: boolean) => void;

  setPlaying: (v: boolean) => void;
  setZoom: (z: number) => void;

  loadProject: (data: SerializedProject) => void;
}

export interface SerializedProject {
  projectName: string;
  scenes: Scene[];
  activeSceneId: string;
}

let idCounter = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

const defaultQuad = (): QuadCorners => ({
  tl: { x: 0.15, y: 0.15 },
  tr: { x: 0.85, y: 0.15 },
  br: { x: 0.85, y: 0.85 },
  bl: { x: 0.15, y: 0.85 },
});

export function createLayer(type: LayerType, name?: string, shaderBody?: string): Layer {
  const cols = 5;
  const rows = 5;
  return {
    id: uid("layer"),
    name: name ?? defaultLayerName(type),
    type,
    shaderBody: type === "shader" ? shaderBody ?? SHADER_PRESETS.plasma.body : undefined,
    warpMode: "quad",
    quad: defaultQuad(),
    meshCols: cols,
    meshRows: rows,
    meshPoints: generateGrid(cols, rows),
    blend: "normal",
    opacity: 1,
    visible: true,
    locked: false,
    maskEnabled: false,
    mask: { x0: 0, y0: 0, x1: 1, y1: 1 },
  };
}

function defaultLayerName(type: LayerType): string {
  const map: Record<LayerType, string> = {
    video: "Video",
    image: "Görsel",
    camera: "Kamera",
    screen: "Ekran",
    shader: "Shader",
  };
  return map[type];
}

function createScene(name: string): Scene {
  return { id: uid("scene"), name, duration: 8, layers: [] };
}

const initialScene = createScene("Sahne 1");

export const useStore = create<ProjectState>((set, get) => ({
  projectName: "İsimsiz Proje",
  scenes: [initialScene],
  activeSceneId: initialScene.id,
  selectedLayerId: null,
  warpEditMode: true,
  playing: false,
  zoom: 1,

  setProjectName: (n) => set({ projectName: n }),

  addScene: () =>
    set((s) => {
      const sc = createScene(`Sahne ${s.scenes.length + 1}`);
      return { scenes: [...s.scenes, sc], activeSceneId: sc.id, selectedLayerId: null };
    }),

  removeScene: (id) =>
    set((s) => {
      if (s.scenes.length <= 1) return {};
      const scenes = s.scenes.filter((x) => x.id !== id);
      const activeSceneId = s.activeSceneId === id ? scenes[0].id : s.activeSceneId;
      return { scenes, activeSceneId, selectedLayerId: null };
    }),

  renameScene: (id, name) =>
    set((s) => ({ scenes: s.scenes.map((x) => (x.id === id ? { ...x, name } : x)) })),

  setSceneDuration: (id, d) =>
    set((s) => ({ scenes: s.scenes.map((x) => (x.id === id ? { ...x, duration: d } : x)) })),

  setActiveScene: (id) => set({ activeSceneId: id, selectedLayerId: null }),

  reorderScene: (from, to) =>
    set((s) => {
      const scenes = [...s.scenes];
      const [m] = scenes.splice(from, 1);
      scenes.splice(to, 0, m);
      return { scenes };
    }),

  addLayer: (type, name, shaderBody) => {
    const layer = createLayer(type, name, shaderBody);
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === s.activeSceneId ? { ...sc, layers: [...sc.layers, layer] } : sc
      ),
      selectedLayerId: layer.id,
    }));
    return layer.id;
  },

  removeLayer: (id) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === s.activeSceneId ? { ...sc, layers: sc.layers.filter((l) => l.id !== id) } : sc
      ),
      selectedLayerId: s.selectedLayerId === id ? null : s.selectedLayerId,
    })),

  selectLayer: (id) => set({ selectedLayerId: id }),

  updateLayer: (id, patch) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === s.activeSceneId
          ? { ...sc, layers: sc.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }
          : sc
      ),
    })),

  renameLayer: (id, name) => get().updateLayer(id, { name }),

  reorderLayer: (from, to) =>
    set((s) => ({
      scenes: s.scenes.map((sc) => {
        if (sc.id !== s.activeSceneId) return sc;
        const layers = [...sc.layers];
        const [m] = layers.splice(from, 1);
        layers.splice(to, 0, m);
        return { ...sc, layers };
      }),
    })),

  toggleVisible: (id) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === s.activeSceneId
          ? { ...sc, layers: sc.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)) }
          : sc
      ),
    })),

  toggleLocked: (id) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === s.activeSceneId
          ? { ...sc, layers: sc.layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)) }
          : sc
      ),
    })),

  setQuadCorner: (id, corner, x, y) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === s.activeSceneId
          ? {
              ...sc,
              layers: sc.layers.map((l) =>
                l.id === id ? { ...l, quad: { ...l.quad, [corner]: { x, y } } } : l
              ),
            }
          : sc
      ),
    })),

  setMeshPoint: (id, index, x, y) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === s.activeSceneId
          ? {
              ...sc,
              layers: sc.layers.map((l) => {
                if (l.id !== id) return l;
                const meshPoints = l.meshPoints.map((p, i) => (i === index ? { x, y } : p));
                return { ...l, meshPoints };
              }),
            }
          : sc
      ),
    })),

  setMeshResolution: (id, cols, rows) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === s.activeSceneId
          ? {
              ...sc,
              layers: sc.layers.map((l) => {
                if (l.id !== id) return l;
                const meshPoints = resampleGrid(l.meshPoints, l.meshCols, l.meshRows, cols, rows);
                return { ...l, meshCols: cols, meshRows: rows, meshPoints };
              }),
            }
          : sc
      ),
    })),

  setWarpMode: (id, mode) => get().updateLayer(id, { warpMode: mode }),

  setWarpEditMode: (v) => set({ warpEditMode: v }),

  setPlaying: (v) => set({ playing: v }),
  setZoom: (z) => set({ zoom: Math.max(0.25, Math.min(3, z)) }),

  loadProject: (data) =>
    set({
      projectName: data.projectName,
      scenes: data.scenes,
      activeSceneId: data.activeSceneId,
      selectedLayerId: null,
    }),
}));

export function getActiveScene(state: ProjectState): Scene | undefined {
  return state.scenes.find((s) => s.id === state.activeSceneId);
}
