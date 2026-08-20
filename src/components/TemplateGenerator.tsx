import { useEffect, useRef } from "react";
import { computeTemplateLayout, PAGE_HEIGHT_IN, PAGE_WIDTH_IN, renderTemplate } from "../lib/template";

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

  async function handleDownload() {
    const canvas = canvasHolder.current;
    if (!canvas) return;
    // Loaded on demand — jsPDF's default bundle pulls in an HTML-rendering
    // plugin (html2canvas/dompurify) we don't use, so keep it out of the
    // main bundle.
    const { jsPDF } = await import("jspdf");
    // A PDF sized to an exact 8.5x11in page prints reliably at "actual
    // size" everywhere — unlike a plain PNG, whose printed size depends on
    // whatever DPI the OS/print dialog/photo app guesses for it.
    const pdf = new jsPDF({ unit: "in", format: "letter" });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, PAGE_WIDTH_IN, PAGE_HEIGHT_IN);
    pdf.save("handwriting-font-template.pdf");
  }

  return (
    <div className="panel">
      <h3>1. Download &amp; print the template</h3>
      <p className="hint">
        Print at actual size (100% scale, no "fit to page"), fill in each box by hand with a dark pen, then
        scan or photograph the whole sheet straight-on. Keep the three black squares fully visible.
      </p>
      <button className="btn-primary" onClick={handleDownload}>
        Download template (PDF)
      </button>
      <div ref={previewRef} className="template-preview" />
    </div>
  );
}
