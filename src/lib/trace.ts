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
}

interface TraceData {
  layers: TracePath[][];
}

// Erases the printed box border and guide lines from a cell's pixel data
// before it's binarized/traced — but only where they're actually just the
// printed guide, not where real ink happens to cross them. A pixel is only
// whitened if it ISN'T dark enough to plausibly be pen ink, so a letter's
// stem crossing the baseline (or touching the box edge) survives intact.
// This is why the guides can be printed clearly visible (see template.ts)
// without contaminating the trace: darker-than-`inkLuminance` pixels are
// always left alone, guide-gray pixels (and any scan/print artifacts near
// them) are cleaned up.
export function maskGuideArtifacts(
  imageData: ImageData,
  guideLineFractions: number[],
  borderPx = 4,
  bandPx = 4,
  inkLuminance = 115
): void {
  const { width, height, data } = imageData;
  const maybeWhiten = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (lum < inkLuminance) return; // dark enough to be real ink — leave it
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < borderPx; x++) {
      maybeWhiten(x, y);
      maybeWhiten(width - 1 - x, y);
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < borderPx; y++) {
      maybeWhiten(x, y);
      maybeWhiten(x, height - 1 - y);
    }
  }

  for (const frac of guideLineFractions) {
    const cy = Math.round(frac * height);
    for (let dy = -bandPx; dy <= bandPx; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= height) continue;
      for (let x = 0; x < width; x++) maybeWhiten(x, y);
    }
  }
}

// Converts a scanned/photographed cell's pixels into pure black-on-white,
// so the tracer only has one shape (the ink) to deal with.
export function binarize(imageData: ImageData, threshold = 140): ImageData {
  const out = new ImageData(imageData.width, imageData.height);
  const src = imageData.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    const lum = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
    const isInk = lum < threshold;
    const v = isInk ? 0 : 255;
    dst[i] = v;
    dst[i + 1] = v;
    dst[i + 2] = v;
    dst[i + 3] = 255;
  }
  return out;
}

// Traces a binarized cell image into a raw glyph path (cell-pixel space).
export function traceCellToRawPath(imageData: ImageData): RawPath {
  const tracedata: TraceData = ImageTracer.imagedataToTracedata(imageData, TRACE_OPTIONS);
  const inkLayer = tracedata.layers[0] ?? [];

  const path = new opentype.Path();
  for (const tracePath of inkLayer) {
    const segments = tracePath.segments;
    if (segments.length === 0) continue;
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
  return path;
}
