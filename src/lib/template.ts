import { CELL, GLYPH_SET, type GlyphDef } from "../glyphSet";

export const TEMPLATE_COLS = 8;
const PAGE_MARGIN = 70;
const CELL_GAP = 24;
const HEADER_HEIGHT = 130;
// How far outside the grid's bounding box the registration marks sit, so
// they never overlap (and bleed ink into) the corner glyph cells.
const REG_MARK_OFFSET = 28;

export interface Point {
  x: number;
  y: number;
}

export interface TemplateLayout {
  cols: number;
  rows: number;
  canvasWidth: number;
  canvasHeight: number;
  gridOriginX: number;
  gridOriginY: number;
  glyphs: GlyphDef[];
  cellPos: Map<string, Point>; // top-left of each glyph's cell, template pixel space
  regMarks: { tl: Point; tr: Point; bl: Point };
}

export function computeTemplateLayout(glyphs: GlyphDef[] = GLYPH_SET): TemplateLayout {
  const cols = TEMPLATE_COLS;
  const rows = Math.ceil(glyphs.length / cols);
  const gridOriginX = PAGE_MARGIN;
  const gridOriginY = HEADER_HEIGHT + PAGE_MARGIN;
  const gridWidth = cols * CELL.width + (cols - 1) * CELL_GAP;
  const gridHeight = rows * CELL.height + (rows - 1) * CELL_GAP;

  const cellPos = new Map<string, Point>();
  glyphs.forEach((g, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    cellPos.set(g.char, {
      x: gridOriginX + col * (CELL.width + CELL_GAP),
      y: gridOriginY + row * (CELL.height + CELL_GAP),
    });
  });

  return {
    cols,
    rows,
    canvasWidth: gridWidth + PAGE_MARGIN * 2,
    canvasHeight: gridHeight + PAGE_MARGIN * 2 + HEADER_HEIGHT,
    gridOriginX,
    gridOriginY,
    glyphs,
    cellPos,
    regMarks: {
      tl: { x: gridOriginX - REG_MARK_OFFSET, y: gridOriginY - REG_MARK_OFFSET },
      tr: { x: gridOriginX + gridWidth + REG_MARK_OFFSET, y: gridOriginY - REG_MARK_OFFSET },
      bl: { x: gridOriginX - REG_MARK_OFFSET, y: gridOriginY + gridHeight + REG_MARK_OFFSET },
    },
  };
}

const REG_MARK_SIZE = 22;

export function renderTemplate(layout: TemplateLayout): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = layout.canvasWidth;
  canvas.height = layout.canvasHeight;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#111111";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("Handwriting Font Template", PAGE_MARGIN, 44);
  ctx.font = "15px sans-serif";
  ctx.fillStyle = "#444444";
  const instructions = [
    "Print at 100% scale (do not “fit to page”). Write one character per box in dark ink,",
    "staying inside the box. Keep the three black squares fully visible — they're used to align",
    "your scan/photo. Then scan or photograph the whole page straight-on in good, even light.",
  ];
  instructions.forEach((line, i) => ctx.fillText(line, PAGE_MARGIN, 72 + i * 20));

  // Registration marks
  ctx.fillStyle = "#000000";
  for (const mark of [layout.regMarks.tl, layout.regMarks.tr, layout.regMarks.bl]) {
    ctx.fillRect(mark.x - REG_MARK_SIZE / 2, mark.y - REG_MARK_SIZE / 2, REG_MARK_SIZE, REG_MARK_SIZE);
  }

  for (const g of layout.glyphs) {
    const pos = layout.cellPos.get(g.char)!;
    ctx.save();
    ctx.translate(pos.x, pos.y);

    ctx.strokeStyle = "#d8d8d8";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, CELL.width - 1, CELL.height - 1);

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#dcdce6";
    hline(ctx, CELL.xHeightY);
    hline(ctx, CELL.capHeightY);
    hline(ctx, CELL.descenderY);
    ctx.setLineDash([]);

    ctx.strokeStyle = "#c7c7d6";
    hline(ctx, CELL.baselineY);

    ctx.fillStyle = "#e3e3e3";
    ctx.font = "11px sans-serif";
    ctx.fillText(g.name, 6, CELL.height - 8);

    ctx.restore();
  }

  return canvas;
}

function hline(ctx: CanvasRenderingContext2D, y: number) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(CELL.width, y);
  ctx.stroke();
}
