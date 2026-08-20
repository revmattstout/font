import { CELL, GLYPH_SET, type GlyphDef } from "../glyphSet";

export const TEMPLATE_COLS = 8;

// The printable template is sized to an actual US Letter page so that
// "print at 100%" produces a physically correct 8.5x11in sheet. 150 DPI
// keeps the file crisp without being huge.
const PPI = 150;
export const PAGE_WIDTH_IN = 8.5;
export const PAGE_HEIGHT_IN = 11;
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
  regMarks: { tl: Point; tr: Point; br: Point; bl: Point };
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
      br: { x: gridOriginX + gridWidth + REG_MARK_OFFSET, y: gridOriginY + gridHeight + REG_MARK_OFFSET },
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
    "staying inside the box. Keep all four black squares fully visible — they're used to align",
    "your scan/photo. Then scan or photograph the whole page straight-on in good, even light.",
  ];
  instructions.forEach((line, i) => ctx.fillText(line, PAGE_MARGIN, PAGE_MARGIN + 44 + i * 15));

  // Registration marks
  ctx.fillStyle = "#000000";
  for (const mark of [layout.regMarks.tl, layout.regMarks.tr, layout.regMarks.br, layout.regMarks.bl]) {
    ctx.fillRect(mark.x - REG_MARK_SIZE / 2, mark.y - REG_MARK_SIZE / 2, REG_MARK_SIZE, REG_MARK_SIZE);
  }

  for (const g of layout.glyphs) {
    const pos = layout.cellPos.get(g.char)!;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    drawCellGuideLines(ctx, cw, ch);
    ctx.fillStyle = "#a3a3a3";
    ctx.font = "8px sans-serif";
    ctx.fillText(g.name, 3, ch - 3);
    ctx.restore();
  }

  return canvas;
}

// Draws the border + reference guide lines for one cell (assumes ctx is
// already translated to the cell's top-left corner). Shared between the
// visible printed template and computeCellGuideMask below, so the mask is
// guaranteed to line up exactly with what actually gets printed.
function drawCellGuideLines(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
  ctx.strokeStyle = "#9e9e9e";
  ctx.lineWidth = 1.25;
  ctx.strokeRect(0.5, 0.5, cw - 1, ch - 1);

  ctx.setLineDash([2, 2]);
  ctx.strokeStyle = "#b8b8b8";
  hline(ctx, cw, (CELL.xHeightY / CELL.height) * ch);
  hline(ctx, cw, (CELL.capHeightY / CELL.height) * ch);
  hline(ctx, cw, (CELL.descenderY / CELL.height) * ch);
  ctx.setLineDash([]);

  ctx.strokeStyle = "#9b9b9b";
  ctx.lineWidth = 1.5;
  hline(ctx, cw, (CELL.baselineY / CELL.height) * ch);
  ctx.lineWidth = 1.25;
}

function hline(ctx: CanvasRenderingContext2D, width: number, y: number) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
}

// Renders exactly the guide-line/border artwork for one cell (same drawing
// code as the printed template, so it's pixel-perfect ground truth rather
// than an inferred position) and returns a coverage mask: 1 where a guide
// pixel was drawn (antialiasing included, then dilated by a pixel for
// margin), 0 elsewhere. The scan/trace pipeline uses this to know exactly
// which pixels are "guide," independent of how dark that guide happens to
// print or scan.
export function computeCellGuideMask(cw: number, ch: number): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);
  ctx.strokeStyle = "#000000";
  drawCellGuideLines(ctx, cw, ch);

  const { data } = ctx.getImageData(0, 0, cw, ch);
  const covered = new Uint8Array(cw * ch);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    covered[p] = data[i] < 250 ? 1 : 0; // catches antialiased edges too
  }

  // Dilate by 1px for a small margin against print bleed / sub-pixel
  // calibration jitter.
  const mask = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      let hit = false;
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= ch) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= cw) continue;
          if (covered[yy * cw + xx]) {
            hit = true;
            break;
          }
        }
      }
      mask[y * cw + x] = hit ? 1 : 0;
    }
  }
  return mask;
}
