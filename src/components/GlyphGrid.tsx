import { useMemo, useState } from "react";
import opentype from "opentype.js";
import { CELL, GLYPH_SET, type GlyphCategory } from "../glyphSet";
import { useGlyphStore } from "../state/GlyphStore";
import DrawPad from "./DrawPad";
import type { RawPath } from "../lib/rawPath";

const CATEGORY_LABELS: Record<GlyphCategory, string> = {
  upper: "Uppercase",
  lower: "Lowercase",
  digit: "Digits",
  punct: "Punctuation",
};

function MiniGlyph({ path }: { path: RawPath }) {
  const commands = path.commands;
  const w = CELL.width;
  const h = CELL.height;
  const d = useMemo(() => {
    const p = new opentype.Path();
    p.commands = commands;
    return pathToSvgD(p);
  }, [commands]);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mini-glyph">
      <path d={d} fill="#2a2a2a" />
    </svg>
  );
}

function pathToSvgD(path: opentype.Path): string {
  let d = "";
  for (const cmd of path.commands) {
    switch (cmd.type) {
      case "M":
        d += `M${cmd.x},${cmd.y} `;
        break;
      case "L":
        d += `L${cmd.x},${cmd.y} `;
        break;
      case "C":
        d += `C${cmd.x1},${cmd.y1} ${cmd.x2},${cmd.y2} ${cmd.x},${cmd.y} `;
        break;
      case "Q":
        d += `Q${cmd.x1},${cmd.y1} ${cmd.x},${cmd.y} `;
        break;
      case "Z":
        d += "Z ";
        break;
    }
  }
  return d;
}

export default function GlyphGrid() {
  const { glyphs, setGlyph, clearGlyph, isCaptured, capturedCount } = useGlyphStore();
  const [activeChar, setActiveChar] = useState<string | null>(null);

  const categories: GlyphCategory[] = ["upper", "lower", "digit", "punct"];

  return (
    <div>
      <p className="hint">
        {capturedCount} / {GLYPH_SET.length} glyphs drawn. Click any box to draw or edit that letter.
      </p>
      {categories.map((cat) => (
        <div key={cat} className="glyph-category">
          <h3>{CATEGORY_LABELS[cat]}</h3>
          <div className="glyph-grid">
            {GLYPH_SET.filter((g) => g.category === cat).map((g) => (
              <button
                key={g.char}
                className={"glyph-cell" + (isCaptured(g.char) ? " captured" : "")}
                onClick={() => setActiveChar(g.char)}
                title={g.name}
              >
                {isCaptured(g.char) ? (
                  <MiniGlyph path={glyphs[g.char]} />
                ) : (
                  <span className="glyph-placeholder">{g.char}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      {activeChar && (
        <DrawPad
          char={activeChar}
          label={GLYPH_SET.find((g) => g.char === activeChar)!.name}
          existingPath={glyphs[activeChar]}
          onSave={(path) => {
            setGlyph(activeChar, path);
            setActiveChar(null);
          }}
          onDelete={() => {
            clearGlyph(activeChar);
            setActiveChar(null);
          }}
          onClose={() => setActiveChar(null)}
        />
      )}
    </div>
  );
}
