// Shared coordinate system used by BOTH the in-browser drawing canvas and the
// printable template. Keeping these identical means a captured raw path
// (in "cell pixel space", y-down) can be normalized into font units with the
// exact same math regardless of where it came from.
export const CELL = {
  width: 300,
  height: 400,
  // Distance from the top of the cell down to the baseline.
  baselineY: 300,
  // Guide lines, purely visual reference for the person writing/drawing.
  xHeightY: 300 - 160,
  capHeightY: 300 - 220,
  descenderY: 300 + 70,
};

// Font-unit constants (a fairly standard em setup).
export const FONT = {
  unitsPerEm: 1000,
  ascender: 800,
  descender: -200,
  capHeight: 700,
  xHeight: 500,
  leftBearing: 40,
  spaceAdvance: 300,
};

// Scale from cell pixels to font units, derived so the cell's baseline/top
// mapping lines up with the font's ascender line.
export const CELL_TO_FONT_SCALE = FONT.ascender / CELL.baselineY;

export type GlyphCategory = "upper" | "lower" | "digit" | "punct";

export interface GlyphDef {
  char: string;
  name: string;
  unicode: number;
  category: GlyphCategory;
}

function letterName(ch: string) {
  return ch;
}

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const LOWER = "abcdefghijklmnopqrstuvwxyz".split("");
const DIGITS = "0123456789".split("");
const DIGIT_NAMES: Record<string, string> = {
  "0": "zero",
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
  "9": "nine",
};
const PUNCT: { ch: string; name: string }[] = [
  { ch: ".", name: "period" },
  { ch: ",", name: "comma" },
  { ch: "!", name: "exclam" },
  { ch: "?", name: "question" },
  { ch: "'", name: "quotesingle" },
  { ch: '"', name: "quotedbl" },
  { ch: "-", name: "hyphen" },
  { ch: ":", name: "colon" },
  { ch: ";", name: "semicolon" },
];

export const GLYPH_SET: GlyphDef[] = [
  ...UPPER.map((ch) => ({
    char: ch,
    name: letterName(ch),
    unicode: ch.codePointAt(0)!,
    category: "upper" as const,
  })),
  ...LOWER.map((ch) => ({
    char: ch,
    name: letterName(ch),
    unicode: ch.codePointAt(0)!,
    category: "lower" as const,
  })),
  ...DIGITS.map((ch) => ({
    char: ch,
    name: DIGIT_NAMES[ch],
    unicode: ch.codePointAt(0)!,
    category: "digit" as const,
  })),
  ...PUNCT.map(({ ch, name }) => ({
    char: ch,
    name,
    unicode: ch.codePointAt(0)!,
    category: "punct" as const,
  })),
];

export const GLYPH_BY_CHAR = new Map(GLYPH_SET.map((g) => [g.char, g]));
