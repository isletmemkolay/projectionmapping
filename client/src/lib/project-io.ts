// Project save/load via JSON file download/upload.
// Media blobs are NOT serialized (not possible across sessions); only metadata
// (layer type, name, source file name) is kept. On load, media layers must be
// re-uploaded by the user.

import type { SerializedProject, ProjectState } from "./store";

export function serializeProject(state: ProjectState): SerializedProject {
  return {
    projectName: state.projectName,
    activeSceneId: state.activeSceneId,
    scenes: JSON.parse(JSON.stringify(state.scenes)),
  };
}

export function downloadProject(state: ProjectState) {
  const data = serializeProject(state);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${state.projectName.replace(/\s+/g, "_") || "proje"}.pmap.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseProjectFile(file: File): Promise<SerializedProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data.scenes || !Array.isArray(data.scenes)) {
          throw new Error("Geçersiz proje dosyası");
        }
        resolve(data as SerializedProject);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsText(file);
  });
}
