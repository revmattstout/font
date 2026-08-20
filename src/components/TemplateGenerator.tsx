import { useEffect, useRef } from "react";
import { computeTemplateLayout, renderTemplate } from "../lib/template";

export default function TemplateGenerator() {
  const previewRef = useRef<HTMLDivElement>(null);
  const canvasHolder = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const layout = computeTemplateLayout();
    const canvas = renderTemplate(layout);
    canvasHolder.current = canvas;
    const container = previewRef.current;
    if (container) {
      container.innerHTML = "";
      canvas.style.width = "100%";
      canvas.style.border = "1px solid #ddd";
      container.appendChild(canvas);
    }
  }, []);

  function handleDownload() {
    const canvas = canvasHolder.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "handwriting-font-template.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
    }, "image/png");
  }

  return (
    <div className="panel">
      <h3>1. Download &amp; print the template</h3>
      <p className="hint">
        Print at 100% scale (no "fit to page"), fill in each box by hand with a dark pen, then scan or
        photograph the whole sheet straight-on. Keep the three black squares fully visible.
      </p>
      <button className="btn-primary" onClick={handleDownload}>
        Download template (PNG)
      </button>
      <div ref={previewRef} className="template-preview" />
    </div>
  );
}
