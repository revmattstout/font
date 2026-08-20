import React, { useCallback, useEffect, useRef, useState } from "react";
import opentype from "opentype.js";
import { CELL } from "../glyphSet";
import { strokeOutlinePoints, strokesToPath, type Stroke, type StrokePoint } from "../lib/strokesToPath";
import type { RawPath } from "../lib/rawPath";
import { clonePath } from "../lib/rawPath";

interface DrawPadProps {
  char: string;
  label: string;
  existingPath?: RawPath;
  onSave: (path: RawPath) => void;
  onDelete: () => void;
  onClose: () => void;
}

const DISPLAY_SCALE = 2;

export default function DrawPad({ char, label, existingPath, onSave, onDelete, onClose }: DrawPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStroke = useRef<Stroke | null>(null);
  const [, forceRedraw] = useState(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Guides
    ctx.strokeStyle = "#e5e5e5";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, CELL.width - 1, CELL.height - 1);

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#c9c9d8";
    line(ctx, CELL.xHeightY);
    line(ctx, CELL.capHeightY);
    line(ctx, CELL.descenderY);
    ctx.setLineDash([]);

    ctx.strokeStyle = "#9797ad";
    line(ctx, CELL.baselineY);

    // Existing (previously saved) shape, shown as a faint reference.
    if (existingPath && existingPath.commands.length > 0) {
      ctx.fillStyle = "rgba(120, 120, 160, 0.25)";
      paintPath(ctx, existingPath);
    }

    // Committed strokes this session.
    ctx.fillStyle = "#1a1a1a";
    for (const stroke of strokes) {
      paintOutline(ctx, strokeOutlinePoints(stroke));
    }
    if (currentStroke.current) {
      paintOutline(ctx, strokeOutlinePoints(currentStroke.current));
    }
  }, [strokes, existingPath]);

  useEffect(() => {
    draw();
  }, [draw]);

  function line(ctx: CanvasRenderingContext2D, y: number) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CELL.width, y);
    ctx.stroke();
  }

  function paintOutline(ctx: CanvasRenderingContext2D, outline: number[][]) {
    if (outline.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(outline[0][0], outline[0][1]);
    for (let i = 1; i < outline.length; i++) ctx.lineTo(outline[i][0], outline[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  function paintPath(ctx: CanvasRenderingContext2D, path: opentype.Path) {
    ctx.beginPath();
    for (const cmd of path.commands) {
      switch (cmd.type) {
        case "M":
          ctx.moveTo(cmd.x, cmd.y);
          break;
        case "L":
          ctx.lineTo(cmd.x, cmd.y);
          break;
        case "C":
          ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
          break;
        case "Q":
          ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
          break;
        case "Z":
          ctx.closePath();
          break;
      }
    }
    ctx.fill();
  }

  function toCellCoords(e: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    currentStroke.current = [toCellCoords(e)];
    forceRedraw((n) => n + 1);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!currentStroke.current) return;
    currentStroke.current.push(toCellCoords(e));
    draw();
  }

  function handlePointerUp() {
    if (!currentStroke.current) return;
    const finished = currentStroke.current;
    currentStroke.current = null;
    if (finished.length > 1) {
      setStrokes((prev) => [...prev, finished]);
    } else {
      forceRedraw((n) => n + 1);
    }
  }

  function handleUndo() {
    setStrokes((prev) => prev.slice(0, -1));
  }

  function handleClearSession() {
    setStrokes([]);
  }

  function handleSave() {
    if (strokes.length === 0) {
      onClose();
      return;
    }
    const drawnPath = strokesToPath(strokes);
    let finalPath = drawnPath;
    if (existingPath && existingPath.commands.length > 0) {
      finalPath = clonePath(existingPath);
      finalPath.commands = [...finalPath.commands, ...drawnPath.commands];
    }
    onSave(finalPath);
  }

  function handleDelete() {
    setStrokes([]);
    onDelete();
  }

  return (
    <div className="drawpad-overlay" onClick={onClose}>
      <div className="drawpad" onClick={(e) => e.stopPropagation()}>
        <div className="drawpad-header">
          <span className="drawpad-title">
            Draw “{label}” <span className="drawpad-char">{char}</span>
          </span>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={CELL.width}
          height={CELL.height}
          style={{ width: CELL.width * DISPLAY_SCALE, height: CELL.height * DISPLAY_SCALE, touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        <div className="drawpad-actions">
          <button onClick={handleUndo} disabled={strokes.length === 0}>
            Undo stroke
          </button>
          <button onClick={handleClearSession} disabled={strokes.length === 0}>
            Clear new strokes
          </button>
          <button className="btn-danger" onClick={handleDelete}>
            Delete glyph
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
