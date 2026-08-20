import getStroke from "perfect-freehand";
import opentype from "opentype.js";
import type { RawPath } from "./rawPath";

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export type Stroke = StrokePoint[];

export const FREEHAND_OPTIONS = {
  size: 14,
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  simulatePressure: true,
};

export function strokeOutlinePoints(stroke: Stroke): number[][] {
  if (stroke.length === 0) return [];
  return getStroke(
    stroke.map((p) => [p.x, p.y, p.pressure]),
    FREEHAND_OPTIONS
  );
}

// Converts the raw pen strokes captured on a drawing canvas into a single
// opentype.js Path (cell-pixel space). Each stroke becomes its own closed
// contour, so e.g. the dot of an "i" and its stem are two separate contours
// in the same glyph.
export function strokesToPath(strokes: Stroke[]): RawPath {
  const path = new opentype.Path();
  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    const outline = strokeOutlinePoints(stroke);
    if (outline.length < 3) continue;
    path.moveTo(outline[0][0], outline[0][1]);
    for (let i = 1; i < outline.length; i++) {
      path.lineTo(outline[i][0], outline[i][1]);
    }
    path.close();
  }
  return path;
}
