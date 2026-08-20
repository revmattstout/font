import opentype from "opentype.js";
import { FONT, GLYPH_SET } from "../glyphSet";
import { normalizeRawPath } from "./normalize";
import type { RawPath } from "./rawPath";

export interface FontMeta {
  familyName: string;
  styleName: string;
}

// captured[char] = raw path in cell-pixel space, or undefined if not drawn yet.
export function buildFont(captured: Record<string, RawPath | undefined>, meta: FontMeta): opentype.Font {
  const notdefGlyph = new opentype.Glyph({
    name: ".notdef",
    advanceWidth: FONT.spaceAdvance,
    path: new opentype.Path(),
  });

  const spaceGlyph = new opentype.Glyph({
    name: "space",
    unicode: 32,
    advanceWidth: FONT.spaceAdvance,
    path: new opentype.Path(),
  });

  const glyphs: opentype.Glyph[] = [notdefGlyph, spaceGlyph];

  for (const def of GLYPH_SET) {
    const raw = captured[def.char];
    if (!raw) continue;
    const { path, advanceWidth } = normalizeRawPath(raw);
    glyphs.push(
      new opentype.Glyph({
        name: def.name,
        unicode: def.unicode,
        advanceWidth,
        path,
      })
    );
  }

  return new opentype.Font({
    familyName: meta.familyName,
    styleName: meta.styleName,
    unitsPerEm: FONT.unitsPerEm,
    ascender: FONT.ascender,
    descender: FONT.descender,
    glyphs,
  });
}

export function downloadFont(font: opentype.Font, filename: string) {
  const buffer = font.toArrayBuffer();
  const blob = new Blob([buffer], { type: "font/otf" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}
