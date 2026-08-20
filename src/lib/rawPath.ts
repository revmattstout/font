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
