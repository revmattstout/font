import React, { useRef, useState } from "react";
import { CELL } from "../glyphSet";
import { computeTemplateLayout, type Point } from "../lib/template";
import { solveAffine, warpImage } from "../lib/affine";
import { binarize, traceCellToRawPath } from "../lib/trace";
import { useGlyphStore } from "../state/GlyphStore";

const POINT_LABELS = ["top-left square", "top-right square", "bottom-left square"];
const MIN_INK_PIXELS = 40;

type Stage = "upload" | "calibrate" | "done";

export default function TemplateUpload() {
  const { setGlyph } = useGlyphStore();
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [stage, setStage] = useState<Stage>("upload");
  const [processing, setProcessing] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const imgDisplayRef = useRef<HTMLImageElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setImageEl(img);
        setPoints([]);
        setStage("calibrate");
        setResultMsg(null);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    if (points.length >= 3 || !imageEl) return;
    const el = imgDisplayRef.current!;
    const rect = el.getBoundingClientRect();
    const scaleX = imageEl.naturalWidth / rect.width;
    const scaleY = imageEl.naturalHeight / rect.height;
    const p: Point = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
    setPoints((prev) => [...prev, p]);
  }

  function resetPoints() {
    setPoints([]);
  }

  async function processImage() {
    if (!imageEl || points.length !== 3) return;
    setProcessing(true);
    setResultMsg(null);
    try {
      const layout = computeTemplateLayout();
      const matrix = solveAffine(
        [points[0], points[1], points[2]],
        [layout.regMarks.tl, layout.regMarks.tr, layout.regMarks.bl]
      );
      const warped = warpImage(imageEl, matrix, layout.canvasWidth, layout.canvasHeight);
      const ctx = warped.getContext("2d")!;

      let captured = 0;
      for (const g of layout.glyphs) {
        const pos = layout.cellPos.get(g.char)!;
        const raw = ctx.getImageData(pos.x, pos.y, CELL.width, CELL.height);
        const bw = binarize(raw);

        let inkPixels = 0;
        for (let i = 0; i < bw.data.length; i += 4) {
          if (bw.data[i] === 0) inkPixels++;
        }
        if (inkPixels < MIN_INK_PIXELS) continue;

        const path = traceCellToRawPath(bw);
        if (path.commands.length === 0) continue;
        setGlyph(g.char, path);
        captured++;
      }

      setResultMsg(`Traced ${captured} of ${layout.glyphs.length} letters from your scan.`);
      setStage("done");
    } catch (err) {
      setResultMsg("Something went wrong processing the image: " + (err as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  function startOver() {
    setImageEl(null);
    setPoints([]);
    setStage("upload");
    setResultMsg(null);
  }

  return (
    <div className="panel">
      <h3>2. Upload your filled-in template</h3>
      {stage === "upload" && (
        <>
          <p className="hint">Upload a photo or scan of the template sheet you filled in.</p>
          <input type="file" accept="image/*" onChange={handleFile} />
        </>
      )}

      {stage !== "upload" && imageEl && (
        <>
          <p className="hint">
            Click the three black registration squares in order: <b>{POINT_LABELS[points.length] ?? "done"}</b>
            {points.length < 3 ? "." : " — ready to process."}
          </p>
          <div className="calibrate-wrap">
            <img
              ref={imgDisplayRef}
              src={imageEl.src}
              onClick={handleImageClick}
              className="calibrate-img"
              alt="Uploaded template"
            />
            {points.map((p, i) => (
              <div
                key={i}
                className="calibrate-marker"
                style={{
                  left: `${(p.x / imageEl.naturalWidth) * 100}%`,
                  top: `${(p.y / imageEl.naturalHeight) * 100}%`,
                }}
              >
                {i + 1}
              </div>
            ))}
          </div>
          <div className="drawpad-actions">
            <button onClick={resetPoints} disabled={points.length === 0}>
              Reset points
            </button>
            <button onClick={startOver}>Choose a different photo</button>
            <div style={{ flex: 1 }} />
            <button className="btn-primary" onClick={processImage} disabled={points.length !== 3 || processing}>
              {processing ? "Processing…" : "Process scan"}
            </button>
          </div>
        </>
      )}

      {resultMsg && <p className="hint result-msg">{resultMsg}</p>}
    </div>
  );
}
