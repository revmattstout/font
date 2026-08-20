import type { Point } from "./template";

// An 8-parameter projective (perspective) transform:
//   x' = (h0*x + h1*y + h2) / (h6*x + h7*y + 1)
//   y' = (h3*x + h4*y + h5) / (h6*x + h7*y + 1)
// Unlike an affine transform, this can correct real camera perspective
// ("keystone") distortion — parallel lines in the source that converge in
// the photo (because it wasn't shot perfectly perpendicular to the page)
// map back to parallel lines. A 3-point affine fit cannot do this; it can
// only represent translation/rotation/scale/shear.
export type Homography = number[];

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) maxRow = r;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    const pivot = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

// Solves for the homography mapping src[i] -> dst[i] for 4 point pairs
// (the standard DLT setup: 2 equations per point pair, 8 unknowns).
export function solveHomography(src: [Point, Point, Point, Point], dst: [Point, Point, Point, Point]): Homography {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: X, y: Y } = src[i];
    const { x, y } = dst[i];
    A.push([X, Y, 1, 0, 0, 0, -X * x, -Y * x]);
    b.push(x);
    A.push([0, 0, 0, X, Y, 1, -X * y, -Y * y]);
    b.push(y);
  }
  return solveLinearSystem(A, b);
}

function applyHomography(h: Homography, x: number, y: number): Point {
  const denom = h[6] * x + h[7] * y + 1;
  return { x: (h[0] * x + h[1] * y + h[2]) / denom, y: (h[3] * x + h[4] * y + h[5]) / denom };
}

// Warps `source` onto a new canvas of (width, height): for every output
// (ideal template) pixel, `hDstToSrc` looks up where that content actually
// is in the source photo, and the value is bilinearly sampled from there.
// This is real per-pixel remapping rather than a canvas affine transform,
// since canvas 2D has no way to express a projective transform natively.
export function warpImagePerspective(
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  hDstToSrc: Homography,
  width: number,
  height: number
): HTMLCanvasElement {
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = srcWidth;
  srcCanvas.height = srcHeight;
  const srcCtx = srcCanvas.getContext("2d")!;
  srcCtx.drawImage(source, 0, 0, srcWidth, srcHeight);
  const srcData = srcCtx.getImageData(0, 0, srcWidth, srcHeight).data;

  function sample(sx: number, sy: number): [number, number, number, number] {
    if (sx < 0 || sy < 0 || sx > srcWidth - 1 || sy > srcHeight - 1) return [255, 255, 255, 255];
    const x0 = Math.floor(sx);
    const y0 = Math.floor(sy);
    const x1 = Math.min(x0 + 1, srcWidth - 1);
    const y1 = Math.min(y0 + 1, srcHeight - 1);
    const fx = sx - x0;
    const fy = sy - y0;
    const px = (x: number, y: number) => {
      const i = (y * srcWidth + x) * 4;
      return [srcData[i], srcData[i + 1], srcData[i + 2], srcData[i + 3]];
    };
    const p00 = px(x0, y0);
    const p10 = px(x1, y0);
    const p01 = px(x0, y1);
    const p11 = px(x1, y1);
    const out: [number, number, number, number] = [0, 0, 0, 0];
    for (let c = 0; c < 4; c++) {
      const top = p00[c] * (1 - fx) + p10[c] * fx;
      const bot = p01[c] * (1 - fx) + p11[c] * fx;
      out[c] = top * (1 - fy) + bot * fy;
    }
    return out;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const outImageData = ctx.createImageData(width, height);
  const dst = outImageData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = applyHomography(hDstToSrc, x, y);
      const [r, g, b, a] = sample(src.x, src.y);
      const i = (y * width + x) * 4;
      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = a;
    }
  }
  ctx.putImageData(outImageData, 0, 0);
  return canvas;
}
