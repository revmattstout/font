import getStroke from "perfect-freehand";
import opentype from "opentype.js";
import { difference, union, type Polygon } from "polygon-clipping";
import type { RawPath } from "./rawPath";

type Point = [number, number];
type Ring = Point[];

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

function ringsToPath(rings: Ring[][]): RawPath {
  const path = new opentype.Path();
  for (const polygon of rings) {
    for (const ring of polygon) {
      if (ring.length < 3) continue;
      path.moveTo(ring[0][0], ring[0][1]);
      for (let i = 1; i < ring.length; i++) {
        path.lineTo(ring[i][0], ring[i][1]);
      }
      path.close();
    }
  }
  return path;
}

function ringSignedArea(ring: Ring): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

// Splits a RawPath's M/L/Z command stream back into its individual rings.
// Only used to re-derive input for another union/difference pass (e.g. when
// adding more strokes to an already-saved glyph) — never for final output.
function rawPathToRings(path: RawPath): Ring[] {
  const rings: Ring[] = [];
  let current: Ring = [];
  for (const cmd of path.commands) {
    if (cmd.type === "M") {
      current = [[cmd.x, cmd.y]];
    } else if (cmd.type === "L") {
      current.push([cmd.x, cmd.y]);
    } else if (cmd.type === "Z") {
      if (current.length >= 3) rings.push(current);
      current = [];
    }
  }
  return rings;
}

// Splits a RawPath's rings into "solid" (outer boundaries) and "hole"
// (counters) groups. polygon-clipping always winds outer rings and holes
// in opposite directions, so rings sharing the largest ring's orientation
// are outer boundaries and the rest are holes — true regardless of which
// way is "clockwise" in this y-down coordinate space.
function classifyRings(path: RawPath): { solids: Ring[]; holes: Ring[] } {
  const rings = rawPathToRings(path);
  if (rings.length === 0) return { solids: [], holes: [] };
  const areas = rings.map(ringSignedArea);
  const majoritySign = Math.sign(areas.reduce((a, b) => (Math.abs(a) >= Math.abs(b) ? a : b)));
  const solids: Ring[] = [];
  const holes: Ring[] = [];
  rings.forEach((ring, i) => (Math.sign(areas[i]) === majoritySign ? solids : holes).push(ring));
  return { solids, holes };
}

// Combines a set of filled polygons ("solid" ink, e.g. stroke outlines) and
// polygons to subtract from them ("holes") into a single RawPath, via a
// true geometric union + difference rather than naive contour
// concatenation. This is what makes loops in messy, self-crossing, or
// multi-stroke handwriting come out as real holes instead of getting
// filled solid, and lets adding new strokes to an already-saved glyph
// combine correctly with its existing ink instead of just layering on top.
function combineRings(solids: Ring[], holes: Ring[]): RawPath {
  if (solids.length === 0) return new opentype.Path();
  const solidPolys: Polygon[] = solids.map((ring) => [ring]);
  let merged = union(solidPolys[0], ...solidPolys.slice(1));
  if (holes.length > 0) {
    const holePolys: Polygon[] = holes.map((ring) => [ring]);
    merged = difference(merged, ...holePolys);
  }
  return ringsToPath(merged);
}

// Converts the raw pen strokes captured on a drawing canvas into a single
// opentype.js Path (cell-pixel space).
//
// Each stroke's outline from perfect-freehand is just the ribbon shape of
// that one pen movement — real (messy, jittery, sometimes self-crossing)
// handwriting can easily make naive contour concatenation fill in a loop's
// interior instead of leaving it as a hole. So instead we treat every
// stroke as a filled polygon and compute their true geometric union with
// polygon-clipping: overlapping ink merges correctly, self-intersections
// resolve via the non-zero rule, and anything a stroke actually encloses
// comes out as a real hole (e.g. the counters of a "b" or "o"). Strokes
// that don't touch (like the dot and stem of an "i") stay separate.
export function strokesToPath(strokes: Stroke[]): RawPath {
  const solids: Ring[] = [];
  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    const outline = strokeOutlinePoints(stroke);
    if (outline.length < 3) continue;
    solids.push(outline.map(([x, y]) => [x, y] as Point));
  }
  return combineRings(solids, []);
}

// Adds new strokes to a glyph that may already have saved ink, merging
// them with a proper union/difference pass instead of just concatenating
// path commands (which would silently break existing holes wherever the
// new strokes overlap them).
export function mergeStrokesIntoPath(existingPath: RawPath | undefined, strokes: Stroke[]): RawPath {
  const { solids, holes } = existingPath ? classifyRings(existingPath) : { solids: [], holes: [] };
  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    const outline = strokeOutlinePoints(stroke);
    if (outline.length < 3) continue;
    solids.push(outline.map(([x, y]) => [x, y] as Point));
  }
  return combineRings(solids, holes);
}
