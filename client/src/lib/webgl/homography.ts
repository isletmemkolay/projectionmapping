// 4-point homography (perspective transform) computation.
// Given a unit source quad and 4 destination corners, compute a 3x3 matrix H
// such that H * [sx, sy, 1] = w * [dx, dy, 1] for each corner pair.
//
// Corner order (consistent everywhere): TL, TR, BR, BL
//   source unit square: (0,0) (1,0) (1,1) (0,1)
//
// Returns a column-major 3x3 (9-element) array suitable for a GLSL `mat3` uniform.

export type Point = { x: number; y: number };

/**
 * Solve a linear system A x = b using Gaussian elimination with partial pivoting.
 * A is n x n (row-major), b is length n. Returns x (length n) or null if singular.
 */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Augmented matrix
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let pivot = col;
    let maxVal = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > maxVal) {
        maxVal = v;
        pivot = r;
      }
    }
    if (maxVal < 1e-12) return null; // singular
    if (pivot !== col) {
      const tmp = M[pivot];
      M[pivot] = M[col];
      M[col] = tmp;
    }
    // Eliminate
    const pivVal = M[col][col];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col] / pivVal;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }

  const x = new Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = M[i][n] / M[i][i];
  }
  return x;
}

/**
 * Compute homography from the unit source quad (0,0)(1,0)(1,1)(0,1)
 * to the given 4 destination points (order TL, TR, BR, BL).
 * Returns a column-major 9-element matrix for use as a GLSL mat3.
 */
export function computeHomography(dst: [Point, Point, Point, Point]): Float32Array {
  const src: Point[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];

  // We solve for the 8 unknowns of H (h33 = 1):
  // [h11 h12 h13 h21 h22 h23 h31 h32]
  // For each correspondence (sx,sy)->(dx,dy):
  //   dx = (h11*sx + h12*sy + h13) / (h31*sx + h32*sy + 1)
  //   dy = (h21*sx + h22*sy + h23) / (h31*sx + h32*sy + 1)
  // Rearranged into two linear equations per point.
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i];
    const { x: dx, y: dy } = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }

  const h = solveLinear(A, b);
  if (!h) {
    // Fallback to identity-ish if degenerate
    return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }

  // Row-major H:
  // [ h0 h1 h2 ]
  // [ h3 h4 h5 ]
  // [ h6 h7 1  ]
  // GLSL mat3 is column-major, so transpose on upload.
  const rowMajor = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];

  return new Float32Array([
    rowMajor[0], rowMajor[3], rowMajor[6], // col 0
    rowMajor[1], rowMajor[4], rowMajor[7], // col 1
    rowMajor[2], rowMajor[5], rowMajor[8], // col 2
  ]);
}
