import opentype from "opentype.js";
import { CELL_TO_FONT_SCALE, FONT } from "../glyphSet";
import type { RawPath } from "./rawPath";

export interface NormalizedGlyph {
  path: opentype.Path;
  advanceWidth: number;
}

// Maps a command's coordinate fields from cell-pixel space (y-down) into
// font-unit space (y-up), using a uniform scale. Because the transform is
// affine, it can be applied independently to every point/control-point of a
// command and Bezier curves remain correct.
function transformPoint(x: number, y: number, scale: number) {
  return {
    x: x * scale,
    y: FONT.ascender - y * scale,
  };
}

function transformCommand(cmd: opentype.PathCommand, scale: number): opentype.PathCommand {
  switch (cmd.type) {
    case "M":
    case "L": {
      const p = transformPoint(cmd.x, cmd.y, scale);
      return { type: cmd.type, x: p.x, y: p.y };
    }
    case "C": {
      const p1 = transformPoint(cmd.x1, cmd.y1, scale);
      const p2 = transformPoint(cmd.x2, cmd.y2, scale);
      const p = transformPoint(cmd.x, cmd.y, scale);
      return { type: "C", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, x: p.x, y: p.y };
    }
    case "Q": {
      const p1 = transformPoint(cmd.x1, cmd.y1, scale);
      const p = transformPoint(cmd.x, cmd.y, scale);
      return { type: "Q", x1: p1.x, y1: p1.y, x: p.x, y: p.y };
    }
    case "Z":
      return { type: "Z" };
    default:
      return cmd;
  }
}

// Converts a raw path (cell-pixel space) into a properly positioned glyph
// path in font units, with left/right side bearings and an advance width
// derived from the ink's own bounding box.
export function normalizeRawPath(raw: RawPath): NormalizedGlyph {
  const scaled = new opentype.Path();
  scaled.commands = raw.commands.map((cmd) => transformCommand(cmd, CELL_TO_FONT_SCALE));

  if (scaled.commands.length === 0) {
    return { path: scaled, advanceWidth: FONT.spaceAdvance };
  }

  const bbox = scaled.getBoundingBox();
  const shiftX = FONT.leftBearing - bbox.x1;
  scaled.commands = scaled.commands.map((cmd) => shiftCommandX(cmd, shiftX));

  const inkWidth = bbox.x2 - bbox.x1;
  const advanceWidth = Math.round(inkWidth + FONT.leftBearing * 2);

  return { path: scaled, advanceWidth };
}

function shiftCommandX(cmd: opentype.PathCommand, dx: number): opentype.PathCommand {
  switch (cmd.type) {
    case "M":
    case "L":
      return { ...cmd, x: cmd.x + dx };
    case "C":
      return { ...cmd, x: cmd.x + dx, x1: cmd.x1 + dx, x2: cmd.x2 + dx };
    case "Q":
      return { ...cmd, x: cmd.x + dx, x1: cmd.x1 + dx };
    default:
      return cmd;
  }
}
