// @ts-expect-error - imagetracerjs ships no type declarations
import ImageTracer from "imagetracerjs";
import opentype from "opentype.js";
import type { RawPath } from "./rawPath";

const TRACE_OPTIONS = {
  pal: [
    { r: 0, g: 0, b: 0, a: 255 },
    { r: 255, g: 255, b: 255, a: 255 },
  ],
  pathomit: 0,
  ltres: 1,
  qtres: 1,
  roundcoords: 2,
  layering: 0,
};

interface TraceSegment {
  type: "L" | "Q";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3?: number;
  y3?: number;
}

interface TracePath {
  segments: TraceSegment[];
  isholepath: boolean;
  holechildren: number[];
}

interface TraceData {
  layers: TracePath[][];
}

// Erases the printed box border and guide lines from an ALREADY-BINARIZED
// cell image — by shape, not by position or darkness.
//
// Two earlier approaches both broke down: whitening guide pixels only when
// they weren't dark enough to be ink assumed the guide always prints
// lighter than real ink, which plenty of consumer printers violate (light
// grays dither into a dot pattern that reads as solid dark once scanned).
// Unconditionally erasing a fixed-width band at each guide row fixed that,
// but breaks any ink that runs close to *tangent* to a guide line (the top
// of an "O" sitting right at the cap-height guide, say) — the band removes
// a long arc of the curve there, not just a short crossing, because the
// curve barely rises within that band's width. No fixed gap-closing radius
// can bridge that without also being large enough to eat real small
// counters elsewhere.
//
// The actual distinguishing feature between "this is the guide line" and
// "this is a real letter" isn't color or position — it's thickness. A
// printed guide is geometrically thin wherever it is; real ink (per the
// template's own "write in dark ink" instruction) is many times thicker.
// So for each guide row, only pixels belonging to a short contiguous run
// of ink THROUGH that row get erased — the whole run, so no gap is left to
// bridge in the first place. A run longer than `maxRunLength` is real ink
// and is left completely untouched, no matter how dark the guide itself
// printed.
export function removeThinGuideLines(imageData: ImageData, guideRows: number[], maxRunLength = 7): void {
  const { width, height, data } = imageData;
  const isInk = (x: number, y: number) => data[(y * width + x) * 4] === 0;
  const whiten = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  };

  function clearShortVerticalRun(x: number, y: number) {
    if (!isInk(x, y)) return;
    let top = y;
    let bottom = y;
    while (top > 0 && isInk(x, top - 1)) top--;
    while (bottom < height - 1 && isInk(x, bottom + 1)) bottom++;
    if (bottom - top + 1 <= maxRunLength) {
      for (let yy = top; yy <= bottom; yy++) whiten(x, yy);
    }
  }
  function clearShortHorizontalRun(x: number, y: number) {
    if (!isInk(x, y)) return;
    let left = x;
    let right = x;
    while (left > 0 && isInk(left - 1, y)) left--;
    while (right < width - 1 && isInk(right + 1, y)) right++;
    if (right - left + 1 <= maxRunLength) {
      for (let xx = left; xx <= right; xx++) whiten(xx, y);
    }
  }

  // Horizontal guide lines (including the top/bottom box border): scan a
  // few rows around each nominal position — the printed/scanned line may
  // land a pixel or two off — and clear whichever runs are thin there.
  const rows = [...guideRows, 0, height - 1];
  for (const cy of rows) {
    for (let dy = -1; dy <= 1; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= height) continue;
      for (let x = 0; x < width; x++) clearShortVerticalRun(x, y);
    }
  }

  // Left/right box border, same idea but horizontal runs.
  for (const cx of [0, width - 1]) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      if (x < 0 || x >= width) continue;
      for (let y = 0; y < height; y++) clearShortHorizontalRun(x, y);
    }
  }

  // The small reference label (glyph name) printed in the bottom-left
  // corner of every cell — nobody writes there, so it's safe to always
  // erase the whole area outright regardless of shape.
  const labelY0 = Math.round(height * 0.84);
  const labelX1 = Math.round(width * 0.6);
  for (let y = labelY0; y < height; y++) {
    for (let x = 0; x < labelX1; x++) whiten(x, y);
  }
}

// Sum of an axis-aligned box via a summed-area table, so a local average
// over any radius costs a handful of array reads instead of scanning the
// whole neighborhood per pixel.
function buildIntegralImage(values: Float64Array, width: number, height: number): Float64Array {
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += values[y * width + x];
      integral[(y + 1) * stride + (x + 1)] = integral[y * stride + (x + 1)] + rowSum;
    }
  }
  return integral;
}

function boxSum(integral: Float64Array, width: number, x0: number, y0: number, x1: number, y1: number): number {
  const stride = width + 1;
  return (
    integral[(y1 + 1) * stride + (x1 + 1)] -
    integral[y0 * stride + (x1 + 1)] -
    integral[(y1 + 1) * stride + x0] +
    integral[y0 * stride + x0]
  );
}

// Converts a scanned/photographed cell's pixels into pure black-on-white,
// so the tracer only has one shape (the ink) to deal with.
//
// Uses a LOCAL threshold (each pixel judged against the average brightness
// of its own neighborhood) rather than one fixed global cutoff. A single
// global threshold falls apart on real photos: unusually glossy ink or a
// phone camera's sharpening can put a bright hairline reflection right
// down the center of a pen stroke, which a global cutoff reads as a gap in
// the ink — turning what should be one solid stroke into two thin parallel
// ones, and (worse) making a closed loop's true boundary unreadable. A
// local threshold mostly shrugs this off since the hairline is still much
// darker than the true background nearby.
export function adaptiveBinarize(imageData: ImageData, radius = 9, bias = 12): ImageData {
  const { width, height, data } = imageData;
  const lum = new Float64Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const integral = buildIntegralImage(lum, width, height);

  const out = new ImageData(width, height);
  const dst = out.data;
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const localMean = boxSum(integral, width, x0, y0, x1, y1) / count;
      const isInk = lum[y * width + x] < localMean - bias;
      const v = isInk ? 0 : 255;
      const i = (y * width + x) * 4;
      dst[i] = v;
      dst[i + 1] = v;
      dst[i + 2] = v;
      dst[i + 3] = 255;
    }
  }
  return out;
}

function inkAt(data: Uint8ClampedArray, width: number, x: number, y: number): boolean {
  return data[(y * width + x) * 4] === 0;
}

// Morphological "closing" (dilate then erode) on an already-binarized
// image: bridges thin gaps inside a stroke — like the hairline reflection
// described above — without meaningfully changing the outline of anything
// bigger than `radius`, so genuine letter counters (o/b/8/etc, always many
// times wider than a reflection artifact) are left alone.
export function closeInkGaps(imageData: ImageData, radius = 3): ImageData {
  const { width, height, data } = imageData;

  const dilated = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let ink = false;
      for (let dy = -radius; dy <= radius && !ink; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          if (inkAt(data, width, xx, yy)) {
            ink = true;
            break;
          }
        }
      }
      const i = (y * width + x) * 4;
      const v = ink ? 0 : 255;
      dilated[i] = v;
      dilated[i + 1] = v;
      dilated[i + 2] = v;
      dilated[i + 3] = 255;
    }
  }

  const out = new ImageData(width, height);
  const dst = out.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let allInk = true;
      for (let dy = -radius; dy <= radius && allInk; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) {
          allInk = false;
          break;
        }
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width || !inkAt(dilated, width, xx, yy)) {
            allInk = false;
            break;
          }
        }
      }
      const i = (y * width + x) * 4;
      const v = allInk ? 0 : 255;
      dst[i] = v;
      dst[i + 1] = v;
      dst[i + 2] = v;
      dst[i + 3] = 255;
    }
  }
  return out;
}

function emitForward(path: RawPath, segments: TraceSegment[]) {
  if (segments.length === 0) return;
  path.moveTo(segments[0].x1, segments[0].y1);
  for (const seg of segments) {
    if (seg.type === "L") {
      path.lineTo(seg.x2, seg.y2);
    } else {
      path.quadTo(seg.x2, seg.y2, seg.x3!, seg.y3!);
    }
  }
  path.close();
}

// Emits a hole's boundary walked backwards, which is what actually makes
// it render as a hole. imagetracerjs's own SVG writer does the same thing
// (see its getsvgstring, which walks a hole's segments in reverse) — a
// hole must wind opposite to its outer boundary for the nonzero fill rule
// to punch it out; emitting every contour in the same (forward) direction,
// hole or not, gives outer and hole the same winding and the "hole" just
// renders as solid extra ink.
function emitReversed(path: RawPath, segments: TraceSegment[]) {
  if (segments.length === 0) return;
  const last = segments[segments.length - 1];
  if (last.type === "Q") {
    path.moveTo(last.x3!, last.y3!);
  } else {
    path.moveTo(last.x2, last.y2);
  }
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (seg.type === "Q") {
      path.quadTo(seg.x2, seg.y2, seg.x1, seg.y1);
    } else {
      path.lineTo(seg.x1, seg.y1);
    }
  }
  path.close();
}

// Traces a binarized cell image into a raw glyph path (cell-pixel space).
export function traceCellToRawPath(imageData: ImageData): RawPath {
  const tracedata: TraceData = ImageTracer.imagedataToTracedata(imageData, TRACE_OPTIONS);
  const inkLayer = tracedata.layers[0] ?? [];

  const path = new opentype.Path();
  for (const tracePath of inkLayer) {
    if (tracePath.isholepath) continue; // emitted below, via its parent's holechildren
    emitForward(path, tracePath.segments);
    for (const holeIndex of tracePath.holechildren) {
      const hole = inkLayer[holeIndex];
      if (hole) emitReversed(path, hole.segments);
    }
  }
  return path;
}
