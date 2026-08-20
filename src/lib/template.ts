import { CELL, GLYPH_SET, type GlyphDef } from "../glyphSet";

export const TEMPLATE_COLS = 8;

// The printable template is sized to an actual US Letter page so that
// "print at 100%" produces a physically correct 8.5x11in sheet. 150 DPI
// keeps the file crisp without being huge.
const PPI = 150;
const PAGE_WIDTH_IN = 8.5;
const PAGE_HEIGHT_IN = 11;
export const PAGE_WIDTH = Math.round(PAGE_WIDTH_IN * PPI);
export const PAGE_HEIGHT = Math.round(PAGE_HEIGHT_IN * PPI);

const PAGE_MARGIN = Math.round(0.3 * PPI);
const CELL_GAP = Math.round(0.05 * PPI);
const HEADER_HEIGHT = Math.round(0.85 * PPI);
// How far outside the grid's bounding box the registration marks sit, so
// they never overlap (and bleed ink into) the corner glyph cells.
const REG_MARK_OFFSET = Math.round(0.1 * PPI);
const REG_MARK_SIZE = Math.round(0.09 * PPI);

// Glyph cells on the page keep the same aspect ratio as the internal
// glyph-authoring CELL, so a traced cell can be rescaled into CELL space
// with one uniform scale factor (no distortion).
const CELL_ASPECT = CELL.width / CELL.height;

// Vertical position (as a fraction of cell height) of each printed guide
// line. Exported so the scan/trace pipeline can blank out these exact rows
// before tracing — the guides can then be printed dark and legible without
// any risk of being mistaken for ink.
export const GUIDE_LINE_FRACTIONS = [
  CELL.capHeightY / CELL.height,
  CELL.xHeightY / CELL.height,
  CELL.baselineY / CELL.height,
  CELL.descenderY / CELL.height,
];

export interface Point {
  x: number;
  y: number;
}

export interface CellSize {
  width: number;
  height: number;
}

export interface TemplateLayout {
  cols: number;
  rows: number;
  canvasWidth: number;
  canvasHeight: number;
  gridOriginX: number;
  gridOriginY: number;
  cellSize: CellSize;
  glyphs: GlyphDef[];
  cellPos: Map<string, Point>; // top-left of each glyph's cell, template pixel space
  regMarks: { tl: Point; tr: Point; bl: Point };
}

export function computeTemplateLayout(glyphs: GlyphDef[] = GLYPH_SET): TemplateLayout {
  const cols = TEMPLATE_COLS;
  const rows = Math.ceil(glyphs.length / cols);

  // Cell height is the binding constraint (cells are taller than wide),
  // so size cells to fill the available vertical space on the page, then
  // center the resulting grid horizontally.
  const availableHeight = PAGE_HEIGHT - PAGE_MARGIN - HEADER_HEIGHT - PAGE_MARGIN;
  const cellHeight = Math.floor((availableHeight - (rows - 1) * CELL_GAP) / rows);
  const cellWidth = Math.round(cellHeight * CELL_ASPECT);

  const gridWidth = cols * cellWidth + (cols - 1) * CELL_GAP;
  const gridHeight = rows * cellHeight + (rows - 1) * CELL_GAP;

  const gridOriginX = Math.round((PAGE_WIDTH - gridWidth) / 2);
  const gridOriginY = PAGE_MARGIN + HEADER_HEIGHT;

  const cellPos = new Map<string, Point>();
  glyphs.forEach((g, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    cellPos.set(g.char, {
      x: gridOriginX + col * (cellWidth + CELL_GAP),
      y: gridOriginY + row * (cellHeight + CELL_GAP),
    });
  });

  return {
    cols,
    rows,
    canvasWidth: PAGE_WIDTH,
    canvasHeight: PAGE_HEIGHT,
    gridOriginX,
    gridOriginY,
    cellSize: { width: cellWidth, height: cellHeight },
    glyphs,
    cellPos,
    regMarks: {
      tl: { x: gridOriginX - REG_MARK_OFFSET, y: gridOriginY - REG_MARK_OFFSET },
      tr: { x: gridOriginX + gridWidth + REG_MARK_OFFSET, y: gridOriginY - REG_MARK_OFFSET },
      bl: { x: gridOriginX - REG_MARK_OFFSET, y: gridOriginY + gridHeight + REG_MARK_OFFSET },
    },
  };
}

export function renderTemplate(layout: TemplateLayout): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = layout.canvasWidth;
  canvas.height = layout.canvasHeight;
  const ctx = canvas.getContext("2d")!;
  const { width: cw, height: ch } = layout.cellSize;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#111111";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText("Handwriting Font Template", PAGE_MARGIN, PAGE_MARGIN + 22);
  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#444444";
  const instructions = [
    "Print at 100% scale (do not “fit to page”). Write one character per box in dark ink,",
    "staying inside the box. Keep the three black squares fully visible — they're used to align",
    "your scan/photo. Then scan or photograph the whole page straight-on in good, even light.",
  ];
  instructions.forEach((line, i) => ctx.fillText(line, PAGE_MARGIN, PAGE_MARGIN + 44 + i * 15));

  // Registration marks
  ctx.fillStyle = "#000000";
  for (const mark of [layout.regMarks.tl, layout.regMarks.tr, layout.regMarks.bl]) {
    ctx.fillRect(mark.x - REG_MARK_SIZE / 2, mark.y - REG_MARK_SIZE / 2, REG_MARK_SIZE, REG_MARK_SIZE);
  }

  for (const g of layout.glyphs) {
    const pos = layout.cellPos.get(g.char)!;
    ctx.save();
    ctx.translate(pos.x, pos.y);

    ctx.strokeStyle = "#8a8a8a";
    ctx.lineWidth = 1.25;
    ctx.strokeRect(0.5, 0.5, cw - 1, ch - 1);

    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = "#aaaaaa";
    hline(ctx, cw, (CELL.xHeightY / CELL.height) * ch);
    hline(ctx, cw, (CELL.capHeightY / CELL.height) * ch);
    hline(ctx, cw, (CELL.descenderY / CELL.height) * ch);
    ctx.setLineDash([]);

    ctx.strokeStyle = "#555555";
    hline(ctx, cw, (CELL.baselineY / CELL.height) * ch);

    ctx.fillStyle = "#999999";
    ctx.font = "8px sans-serif";
    ctx.fillText(g.name, 3, ch - 3);

    ctx.restore();
  }

  return canvas;
}

function hline(ctx: CanvasRenderingContext2D, width: number, y: number) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
}
