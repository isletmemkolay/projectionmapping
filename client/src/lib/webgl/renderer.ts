// Minimal WebGL2 projection-mapping renderer.
// - One program for quad (homography) layers, one for mesh layers, one for
//   generative shaders (compiled per-layer), one for wireframe overlay.
// - Texture sources (video/image/camera/screen) live in a runtime map keyed by
//   layer id, kept OUT of the zustand store (handles aren't serializable).
// - draw() composites all visible layers of the active scene each frame.

import type { Layer, Scene } from "../store";
import { applyBlendMode, type BlendMode } from "./blend-modes";
import { computeHomography } from "./homography";
import { buildMeshIndices, buildMeshPositions, buildMeshUVs } from "./mesh";
import { QUAD_VERT, MESH_VERT, TEXTURE_FRAG, WIRE_FRAG, buildShaderFrag } from "./shaders";

export interface LayerSource {
  type: "video" | "image" | "shader";
  video?: HTMLVideoElement;
  image?: HTMLImageElement | ImageBitmap;
  texture?: WebGLTexture;
  flip: boolean; // sample-flip for video/camera streams
  uploaded?: boolean; // for images
  // shader runtime
  shaderProgram?: WebGLProgram;
  shaderBody?: string;
  shaderError?: string | null;
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(log || "shader compile error");
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  const v = compileShader(gl, gl.VERTEX_SHADER, vs);
  const f = compileShader(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error(log || "program link error");
  }
  return p;
}

export class Renderer {
  gl: WebGL2RenderingContext;
  private texFragProgram: WebGLProgram; // texture via mesh-style positions
  private quadTexProgram: WebGLProgram; // homography + texture
  private wireProgram: WebGLProgram;

  private unitQuadVBO: WebGLBuffer;
  private meshPosVBO: WebGLBuffer;
  private meshUVVBO: WebGLBuffer;
  private meshIBO: WebGLBuffer;

  private sources = new Map<string, LayerSource>();
  private startTime = performance.now();
  private lastFrame = performance.now();
  private rafId = 0;
  private running = false;
  private getScene: () => Scene | undefined;
  private getEditMode: () => boolean;
  private getSelectedId: () => string | null;
  showHandles = true; // disabled in output window

  constructor(
    canvas: HTMLCanvasElement,
    getScene: () => Scene | undefined,
    getEditMode: () => boolean,
    getSelectedId: () => string | null
  ) {
    const gl = canvas.getContext("webgl2", {
      premultipliedAlpha: false,
      alpha: true,
      antialias: true,
    });
    if (!gl) throw new Error("WebGL2 desteklenmiyor");
    this.gl = gl;
    this.getScene = getScene;
    this.getEditMode = getEditMode;
    this.getSelectedId = getSelectedId;

    // Programs.
    this.quadTexProgram = linkProgram(gl, QUAD_VERT, TEXTURE_FRAG);
    this.texFragProgram = linkProgram(gl, MESH_VERT, TEXTURE_FRAG);
    this.wireProgram = linkProgram(gl, MESH_VERT, WIRE_FRAG);

    // Unit quad (two triangles, 0..1).
    this.unitQuadVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.unitQuadVBO);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW
    );

    this.meshPosVBO = gl.createBuffer()!;
    this.meshUVVBO = gl.createBuffer()!;
    this.meshIBO = gl.createBuffer()!;

    gl.enable(gl.BLEND);
  }

  // ---- Source management ----
  setImageSource(layerId: string, image: HTMLImageElement | ImageBitmap) {
    this.disposeSource(layerId);
    this.sources.set(layerId, { type: "image", image, flip: false, uploaded: false });
  }

  setVideoSource(layerId: string, video: HTMLVideoElement, flip: boolean) {
    this.disposeSource(layerId);
    this.sources.set(layerId, { type: "video", video, flip });
  }

  setShaderSource(layerId: string, body: string): string | null {
    const gl = this.gl;
    let prog: WebGLProgram | undefined;
    let error: string | null = null;
    try {
      prog = linkProgram(gl, MESH_VERT, buildShaderFrag(body));
    } catch (e: any) {
      error = String(e.message || e);
    }
    const existing = this.sources.get(layerId);
    if (existing?.shaderProgram && prog) gl.deleteProgram(existing.shaderProgram);
    this.sources.set(layerId, {
      type: "shader",
      flip: false,
      shaderProgram: prog,
      shaderBody: body,
      shaderError: error,
    });
    return error;
  }

  hasSource(layerId: string): boolean {
    return this.sources.has(layerId);
  }

  disposeSource(layerId: string) {
    const s = this.sources.get(layerId);
    if (!s) return;
    if (s.texture) this.gl.deleteTexture(s.texture);
    if (s.shaderProgram) this.gl.deleteProgram(s.shaderProgram);
    if (s.video) {
      try {
        const ms = s.video.srcObject as MediaStream | null;
        if (ms) ms.getTracks().forEach((t) => t.stop());
        s.video.pause();
      } catch {}
    }
    this.sources.delete(layerId);
  }

  private ensureTexture(s: LayerSource): WebGLTexture {
    const gl = this.gl;
    if (!s.texture) {
      s.texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, s.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
    return s.texture;
  }

  private uploadTexture(s: LayerSource) {
    const gl = this.gl;
    const tex = this.ensureTexture(s);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (s.type === "image" && s.image && !s.uploaded) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s.image as any);
      s.uploaded = true;
    } else if (s.type === "video" && s.video && s.video.readyState >= 2) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s.video);
    }
  }

  // ---- Draw ----
  private drawLayer(layer: Layer, time: number) {
    const gl = this.gl;
    const src = this.sources.get(layer.id);

    applyBlendMode(gl, layer.blend as BlendMode);

    if (layer.type === "shader") {
      if (!src?.shaderProgram) return;
      gl.useProgram(src.shaderProgram);
      gl.uniform1f(gl.getUniformLocation(src.shaderProgram, "u_time"), time);
      gl.uniform2f(
        gl.getUniformLocation(src.shaderProgram, "u_resolution"),
        gl.drawingBufferWidth,
        gl.drawingBufferHeight
      );
      gl.uniform1f(gl.getUniformLocation(src.shaderProgram, "u_opacity"), layer.opacity);
      this.setMaskUniforms(src.shaderProgram, layer);
      if (layer.warpMode === "quad") {
        this.drawQuadAsMesh(layer, src.shaderProgram);
      } else {
        this.drawMeshGeometry(layer, src.shaderProgram);
      }
      return;
    }

    // textured layers (video/image/camera/screen)
    if (!src || (src.type === "image" && !src.image) || (src.type === "video" && !src.video)) {
      return;
    }
    this.uploadTexture(src);
    if (!src.texture) return;

    if (layer.warpMode === "quad") {
      const prog = this.quadTexProgram;
      gl.useProgram(prog);
      const H = computeHomography([layer.quad.tl, layer.quad.tr, layer.quad.br, layer.quad.bl]);
      gl.uniformMatrix3fv(gl.getUniformLocation(prog, "u_homography"), false, H);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.texture);
      gl.uniform1i(gl.getUniformLocation(prog, "u_tex"), 0);
      gl.uniform1f(gl.getUniformLocation(prog, "u_opacity"), layer.opacity);
      gl.uniform1i(gl.getUniformLocation(prog, "u_flipTex"), src.flip ? 1 : 0);
      this.setMaskUniforms(prog, layer);
      // draw unit quad
      gl.bindBuffer(gl.ARRAY_BUFFER, this.unitQuadVBO);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.disableVertexAttribArray(1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } else {
      const prog = this.texFragProgram;
      gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.texture);
      gl.uniform1i(gl.getUniformLocation(prog, "u_tex"), 0);
      gl.uniform1f(gl.getUniformLocation(prog, "u_opacity"), layer.opacity);
      gl.uniform1i(gl.getUniformLocation(prog, "u_flipTex"), src.flip ? 1 : 0);
      this.setMaskUniforms(prog, layer);
      this.drawMeshGeometry(layer, prog);
    }
  }

  private setMaskUniforms(prog: WebGLProgram, layer: Layer) {
    const gl = this.gl;
    const loc = gl.getUniformLocation(prog, "u_useMask");
    if (loc) gl.uniform1i(loc, layer.maskEnabled ? 1 : 0);
    const mloc = gl.getUniformLocation(prog, "u_mask");
    if (mloc) gl.uniform4f(mloc, layer.mask.x0, layer.mask.y0, layer.mask.x1, layer.mask.y1);
  }

  // Draw the NxM mesh as indexed triangles. For shader layers the geometry maps
  // the destination grid into clip space; the UVs map the texture/effect.
  private drawMeshGeometry(layer: Layer, prog: WebGLProgram) {
    const gl = this.gl;
    const cols = layer.meshCols;
    const rows = layer.meshRows;
    const positions = buildMeshPositions(layer.meshPoints);
    const uvs = buildMeshUVs(cols, rows);
    const indices = buildMeshIndices(cols, rows);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshPosVBO);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uvLoc = 1;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshUVVBO);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshIBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  }

  // Draw a single quad (from 4 corners) as two triangles in clip space, with UVs.
  // Used for shader layers in quad warp mode.
  private drawQuadAsMesh(layer: Layer, prog: WebGLProgram) {
    const gl = this.gl;
    const q = layer.quad;
    const toClip = (p: { x: number; y: number }) => [p.x * 2 - 1, (1 - p.y) * 2 - 1];
    const [tlx, tly] = toClip(q.tl);
    const [trx, trY] = toClip(q.tr);
    const [brx, bry] = toClip(q.br);
    const [blx, bly] = toClip(q.bl);
    const positions = new Float32Array([
      tlx, tly, blx, bly, trx, trY,
      trx, trY, blx, bly, brx, bry,
    ]);
    const uvs = new Float32Array([0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshPosVBO);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshUVVBO);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private drawWireframe(layer: Layer) {
    const gl = this.gl;
    const cols = layer.meshCols;
    const rows = layer.meshRows;
    const positions = buildMeshPositions(layer.meshPoints);

    // build line indices
    const lines: number[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (c < cols - 1) lines.push(i, i + 1);
        if (r < rows - 1) lines.push(i, i + cols);
      }
    }
    const lineIdx = new Uint16Array(lines);

    gl.useProgram(this.wireProgram);
    applyBlendMode(gl, "normal");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshPosVBO);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disableVertexAttribArray(1);
    gl.uniform4f(gl.getUniformLocation(this.wireProgram, "u_color"), 0.0, 0.9, 0.95, 0.45);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshIBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lineIdx, gl.DYNAMIC_DRAW);
    gl.drawElements(gl.LINES, lineIdx.length, gl.UNSIGNED_SHORT, 0);
  }

  private frame = () => {
    if (!this.running) return;
    const now = performance.now();
    this.lastFrame = now;
    const time = (now - this.startTime) / 1000;
    const gl = this.gl;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const scene = this.getScene();
    if (scene) {
      for (const layer of scene.layers) {
        if (!layer.visible) continue;
        this.drawLayer(layer, time);
      }
      // wireframe overlay for selected mesh layer in edit mode
      if (this.showHandles && this.getEditMode()) {
        const selId = this.getSelectedId();
        const sel = scene.layers.find((l) => l.id === selId);
        if (sel && sel.visible && sel.warpMode === "mesh") {
          this.drawWireframe(sel);
        }
      }
    }

    this.rafId = requestAnimationFrame(this.frame);
  };

  start() {
    if (this.running) return;
    this.running = true;
    this.startTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  resize(w: number, h: number, dpr: number) {
    const canvas = this.gl.canvas as HTMLCanvasElement;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  dispose() {
    this.stop();
    for (const id of Array.from(this.sources.keys())) this.disposeSource(id);
  }
}
