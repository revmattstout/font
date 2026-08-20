import type { Point } from "./template";

export interface AffineMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

function det3(m: number[][]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

// Solves M * x = v for a 3x3 system via Cramer's rule.
function solve3(m: number[][], v: number[]): number[] {
  const d = det3(m);
  const mx = [
    [v[0], m[0][1], m[0][2]],
    [v[1], m[1][1], m[1][2]],
    [v[2], m[2][1], m[2][2]],
  ];
  const my = [
    [m[0][0], v[0], m[0][2]],
    [m[1][0], v[1], m[1][2]],
    [m[2][0], v[2], m[2][2]],
  ];
  const mz = [
    [m[0][0], m[0][1], v[0]],
    [m[1][0], m[1][1], v[1]],
    [m[2][0], m[2][1], v[2]],
  ];
  return [det3(mx) / d, det3(my) / d, det3(mz) / d];
}

// Solves for the affine transform mapping src[i] -> dst[i] for 3 point pairs,
// in the {a,b,c,d,e,f} form expected by CanvasRenderingContext2D.setTransform:
// x' = a*x + c*y + e ; y' = b*x + d*y + f
export function solveAffine(src: [Point, Point, Point], dst: [Point, Point, Point]): AffineMatrix {
  const m = [
    [src[0].x, src[0].y, 1],
    [src[1].x, src[1].y, 1],
    [src[2].x, src[2].y, 1],
  ];
  const [a, c, e] = solve3(m, [dst[0].x, dst[1].x, dst[2].x]);
  const [b, d, f] = solve3(m, [dst[0].y, dst[1].y, dst[2].y]);
  return { a, b, c, d, e, f };
}

// Warps `source` onto a new canvas of (width, height) using the given
// src->dst affine transform, so that dst pixel space matches the ideal
// template layout regardless of the photo's rotation/scale/offset.
export function warpImage(source: CanvasImageSource, matrix: AffineMatrix, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
  ctx.drawImage(source, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}
