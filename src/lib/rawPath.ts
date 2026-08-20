import opentype from "opentype.js";

// A "raw path" is an opentype.js Path expressed in cell-pixel space
// (origin top-left of the cell, y grows downward), before normalization
// into font units. Both capture modes (draw / trace) produce one of these.
export type RawPath = opentype.Path;

export function newRawPath(): RawPath {
  return new opentype.Path();
}

export function isRawPathEmpty(path: RawPath): boolean {
  return path.commands.length === 0;
}

export function clonePath(path: RawPath): RawPath {
  const clone = new opentype.Path();
  clone.commands = path.commands.map((cmd) => ({ ...cmd }));
  return clone;
}

// Uniformly rescales a raw path's coordinates in place (new path returned).
// Used to bring a traced path from the printable template's on-page cell
// size back into the standard CELL pixel space that normalize.ts expects.
export function scalePath(path: RawPath, scaleX: number, scaleY: number): RawPath {
  const scaled = new opentype.Path();
  scaled.commands = path.commands.map((cmd) => {
    switch (cmd.type) {
      case "M":
      case "L":
        return { ...cmd, x: cmd.x * scaleX, y: cmd.y * scaleY };
      case "C":
        return {
          ...cmd,
          x: cmd.x * scaleX,
          y: cmd.y * scaleY,
          x1: cmd.x1 * scaleX,
          y1: cmd.y1 * scaleY,
          x2: cmd.x2 * scaleX,
          y2: cmd.y2 * scaleY,
        };
      case "Q":
        return { ...cmd, x: cmd.x * scaleX, y: cmd.y * scaleY, x1: cmd.x1 * scaleX, y1: cmd.y1 * scaleY };
      default:
        return cmd;
    }
  });
  return scaled;
}
