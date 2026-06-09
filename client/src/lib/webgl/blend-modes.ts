// Blend mode -> WebGL config mapping.
// Native modes use gl.blendFunc/blendEquation. "overlay" is implemented in the
// fragment shader (see shaders.ts) using a destination-read approach; here we
// gracefully degrade overlay to normal alpha blending for the GL state since we
// composite onto a transparent canvas.

export type BlendMode = "normal" | "multiply" | "screen" | "add" | "overlay";

export const BLEND_MODES: BlendMode[] = ["normal", "multiply", "screen", "add", "overlay"];

export const BLEND_LABELS_TR: Record<BlendMode, string> = {
  normal: "Normal",
  multiply: "Çarp",
  screen: "Ekran",
  add: "Topla",
  overlay: "Kaplama",
};

export interface BlendConfig {
  srcRGB: number;
  dstRGB: number;
  srcA: number;
  dstA: number;
  eqRGB: number;
  eqA: number;
}

export function getBlendConfig(gl: WebGL2RenderingContext, mode: BlendMode): BlendConfig {
  switch (mode) {
    case "multiply":
      // result = src * dst  (premultiplied-ish approximation)
      return {
        srcRGB: gl.DST_COLOR,
        dstRGB: gl.ONE_MINUS_SRC_ALPHA,
        srcA: gl.ONE,
        dstA: gl.ONE_MINUS_SRC_ALPHA,
        eqRGB: gl.FUNC_ADD,
        eqA: gl.FUNC_ADD,
      };
    case "screen":
      return {
        srcRGB: gl.ONE,
        dstRGB: gl.ONE_MINUS_SRC_COLOR,
        srcA: gl.ONE,
        dstA: gl.ONE_MINUS_SRC_ALPHA,
        eqRGB: gl.FUNC_ADD,
        eqA: gl.FUNC_ADD,
      };
    case "add":
      return {
        srcRGB: gl.SRC_ALPHA,
        dstRGB: gl.ONE,
        srcA: gl.ONE,
        dstA: gl.ONE,
        eqRGB: gl.FUNC_ADD,
        eqA: gl.FUNC_ADD,
      };
    case "overlay":
    case "normal":
    default:
      // Standard source-over alpha blending.
      return {
        srcRGB: gl.SRC_ALPHA,
        dstRGB: gl.ONE_MINUS_SRC_ALPHA,
        srcA: gl.ONE,
        dstA: gl.ONE_MINUS_SRC_ALPHA,
        eqRGB: gl.FUNC_ADD,
        eqA: gl.FUNC_ADD,
      };
  }
}

export function applyBlendMode(gl: WebGL2RenderingContext, mode: BlendMode) {
  const c = getBlendConfig(gl, mode);
  gl.blendEquationSeparate(c.eqRGB, c.eqA);
  gl.blendFuncSeparate(c.srcRGB, c.dstRGB, c.srcA, c.dstA);
}
