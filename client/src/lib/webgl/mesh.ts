// NxM grid generation + triangulation for mesh warp.
// Grid points are stored in normalized [0,1] space (UV-aligned), and the user
// drags them in clip/normalized destination space. We keep a parallel array of
// destination positions that default to a regular grid matching the quad bounds.

export type GridPoint = { x: number; y: number };

/**
 * Generate the default mesh destination grid for a cols x rows resolution.
 * Points returned in normalized [0,1] space (top-left origin), row-major.
 * (col index varies fastest). Length = (cols+1)*(rows+1) when expressed in
 * vertices; here cols/rows are the number of *vertices* per axis.
 */
export function generateGrid(cols: number, rows: number): GridPoint[] {
  const pts: GridPoint[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pts.push({ x: c / (cols - 1), y: r / (rows - 1) });
    }
  }
  return pts;
}

/**
 * Build the static UV array for a cols x rows vertex grid (row-major).
 * UVs are fixed (0..1). Returns Float32Array of length cols*rows*2.
 */
export function buildMeshUVs(cols: number, rows: number): Float32Array {
  const uv = new Float32Array(cols * rows * 2);
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      uv[i++] = c / (cols - 1);
      uv[i++] = r / (rows - 1);
    }
  }
  return uv;
}

/**
 * Build indexed triangle list for a cols x rows vertex grid.
 * Each cell -> 2 triangles. Returns Uint16Array.
 */
export function buildMeshIndices(cols: number, rows: number): Uint16Array {
  const idx: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const tl = r * cols + c;
      const tr = tl + 1;
      const bl = tl + cols;
      const br = bl + 1;
      idx.push(tl, bl, tr); // triangle 1
      idx.push(tr, bl, br); // triangle 2
    }
  }
  return new Uint16Array(idx);
}

/**
 * Build a position buffer (clip-space -1..1) from grid points in normalized
 * [0,1] space. Maps x: [0,1] -> [-1,1], y: [0,1] -> [1,-1] (flip for clip space).
 */
export function buildMeshPositions(points: GridPoint[]): Float32Array {
  const pos = new Float32Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    pos[i * 2] = points[i].x * 2 - 1;
    pos[i * 2 + 1] = (1 - points[i].y) * 2 - 1;
  }
  return pos;
}

/**
 * Resample an existing grid to a new resolution using bilinear interpolation,
 * preserving warp shape as best as possible. Used when the user changes mesh
 * resolution. oldPts is row-major for oldCols x oldRows.
 */
export function resampleGrid(
  oldPts: GridPoint[],
  oldCols: number,
  oldRows: number,
  newCols: number,
  newRows: number
): GridPoint[] {
  const sample = (u: number, v: number): GridPoint => {
    const fx = u * (oldCols - 1);
    const fy = v * (oldRows - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(x0 + 1, oldCols - 1);
    const y1 = Math.min(y0 + 1, oldRows - 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const p00 = oldPts[y0 * oldCols + x0];
    const p10 = oldPts[y0 * oldCols + x1];
    const p01 = oldPts[y1 * oldCols + x0];
    const p11 = oldPts[y1 * oldCols + x1];
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const top = { x: lerp(p00.x, p10.x, tx), y: lerp(p00.y, p10.y, tx) };
    const bot = { x: lerp(p01.x, p11.x, tx), y: lerp(p01.y, p11.y, tx) };
    return { x: lerp(top.x, bot.x, ty), y: lerp(top.y, bot.y, ty) };
  };

  const out: GridPoint[] = [];
  for (let r = 0; r < newRows; r++) {
    for (let c = 0; c < newCols; c++) {
      out.push(sample(c / (newCols - 1), r / (newRows - 1)));
    }
  }
  return out;
}
