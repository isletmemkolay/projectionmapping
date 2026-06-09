// GLSL ES 3.00 shader sources for WebGL2.

// ---- Quad warp (homography) ----
// A unit quad (0..1) is transformed by the homography matrix into clip space.
export const QUAD_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_pos;   // unit square 0..1
out vec2 v_uv;
uniform mat3 u_homography;            // maps unit square -> normalized dst (0..1)
uniform float u_flipY;
void main() {
  v_uv = a_pos;
  vec3 p = u_homography * vec3(a_pos, 1.0);
  vec2 ndc = p.xy / p.z;              // normalized 0..1
  float x = ndc.x * 2.0 - 1.0;
  float y = (1.0 - ndc.y) * 2.0 - 1.0;
  gl_Position = vec4(x, y, 0.0, 1.0);
}`;

// ---- Mesh warp ----
// Positions are precomputed in clip space; UVs fixed.
export const MESH_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_pos;   // clip space -1..1
layout(location = 1) in vec2 a_uv;    // 0..1
out vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// ---- Shared textured fragment shader (video/image/camera/screen) ----
export const TEXTURE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform float u_opacity;
uniform int u_flipTex;       // 1 = flip Y when sampling (video/camera)
uniform vec4 u_mask;         // x0,y0,x1,y1 crop rect in uv space (0..1)
uniform int u_useMask;
void main() {
  vec2 uv = v_uv;
  if (u_flipTex == 1) uv.y = 1.0 - uv.y;
  vec4 c = texture(u_tex, uv);
  float a = c.a * u_opacity;
  if (u_useMask == 1) {
    if (v_uv.x < u_mask.x || v_uv.x > u_mask.z || v_uv.y < u_mask.y || v_uv.y > u_mask.w) {
      a = 0.0;
    }
  }
  outColor = vec4(c.rgb, a);
}`;

// ---- Generative shader wrapper ----
// User-provided fragment body must define vec3 render(vec2 uv).
// We provide u_time, u_resolution, opacity + mask handling.
export function buildShaderFrag(userBody: string): string {
  return `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_opacity;
uniform vec4 u_mask;
uniform int u_useMask;

${userBody}

void main() {
  vec2 uv = v_uv;
  vec3 col = render(uv);
  float a = u_opacity;
  if (u_useMask == 1) {
    if (v_uv.x < u_mask.x || v_uv.x > u_mask.z || v_uv.y < u_mask.y || v_uv.y > u_mask.w) {
      a = 0.0;
    }
  }
  outColor = vec4(col, a);
}`;
}

// ---- Wireframe overlay for mesh editing ----
export const WIRE_VERT = MESH_VERT;
export const WIRE_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec4 u_color;
void main() { outColor = u_color; }`;

// ---- Default generative shader presets ----
export const SHADER_PRESETS: Record<string, { label: string; body: string }> = {
  plasma: {
    label: "Plazma",
    body: `vec3 render(vec2 uv) {
  float t = u_time * 0.5;
  float v = sin(uv.x * 10.0 + t)
          + sin(uv.y * 10.0 + t * 1.3)
          + sin((uv.x + uv.y) * 10.0 + t * 0.7)
          + sin(length(uv - 0.5) * 14.0 - t * 2.0);
  v *= 0.25;
  vec3 col = 0.5 + 0.5 * cos(6.2831 * (v + vec3(0.0, 0.33, 0.67)));
  return col;
}`,
  },
  noise: {
    label: "Gürültü",
    body: `float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i+vec2(0,0)), hash(i+vec2(1,0)), u.x),
             mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
vec3 render(vec2 uv) {
  float n = 0.0; float amp = 0.5; vec2 p = uv * 4.0 + u_time * 0.2;
  for (int i=0;i<5;i++){ n += amp*noise(p); p*=2.0; amp*=0.5; }
  return vec3(n) * vec3(0.2, 0.9, 1.0);
}`,
  },
  gradient: {
    label: "Gradyan",
    body: `vec3 render(vec2 uv) {
  vec3 a = vec3(0.05, 0.7, 0.9);
  vec3 b = vec3(0.6, 0.1, 0.9);
  float t = 0.5 + 0.5 * sin(u_time * 0.5 + uv.x * 3.1415);
  return mix(a, b, uv.y) * (0.7 + 0.3 * t);
}`,
  },
  audio: {
    label: "Ses-tepkili (yer tutucu)",
    body: `// Ses analizi için placeholder. u_time tabanlı titreşim.
vec3 render(vec2 uv) {
  float bars = 16.0;
  float idx = floor(uv.x * bars);
  float h = 0.3 + 0.6 * abs(sin(u_time * 2.0 + idx * 0.7));
  float on = step(uv.y, h);
  vec3 col = mix(vec3(0.0,0.3,0.4), vec3(0.0,1.0,1.0), uv.y / h);
  return col * on;
}`,
  },
};
