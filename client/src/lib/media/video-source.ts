// HTMLVideoElement helper for file-based video layers.

export function createVideoElement(url: string): HTMLVideoElement {
  const v = document.createElement("video");
  v.src = url;
  v.crossOrigin = "anonymous";
  v.loop = true;
  v.muted = true;
  v.playsInline = true;
  v.play().catch(() => {
    /* autoplay may require gesture; ignore */
  });
  return v;
}

export function attachStream(stream: MediaStream): HTMLVideoElement {
  const v = document.createElement("video");
  v.srcObject = stream;
  v.muted = true;
  v.playsInline = true;
  v.autoplay = true;
  v.play().catch(() => {});
  return v;
}
