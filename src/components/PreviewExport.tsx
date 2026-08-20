import { useEffect, useRef, useState } from "react";
import { buildFont, downloadFont } from "../lib/buildFont";
import { useGlyphStore } from "../state/GlyphStore";

const DEFAULT_PREVIEW_TEXT = "The quick brown fox jumps over the lazy dog. 0123456789";
const FAMILY_KEY = "__handwriting-preview-family";

export default function PreviewExport() {
  const { glyphs, capturedCount } = useGlyphStore();
  const [familyName, setFamilyName] = useState("My Handwriting");
  const [styleName, setStyleName] = useState("Regular");
  const [previewText, setPreviewText] = useState(DEFAULT_PREVIEW_TEXT);
  const [fontReady, setFontReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeFace = useRef<FontFace | null>(null);
  const previewFamily = useRef(`${FAMILY_KEY}-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (capturedCount === 0) {
      setFontReady(false);
      return;
    }
    try {
      const font = buildFont(glyphs, { familyName: previewFamily.current, styleName });
      const buffer = font.toArrayBuffer();
      const face = new FontFace(previewFamily.current, buffer);
      face
        .load()
        .then((loaded) => {
          if (activeFace.current) document.fonts.delete(activeFace.current);
          document.fonts.add(loaded);
          activeFace.current = loaded;
          setFontReady(true);
          setError(null);
        })
        .catch((e) => setError(String(e)));
    } catch (e) {
      setError((e as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glyphs, styleName, capturedCount]);

  function handleExport() {
    try {
      const font = buildFont(glyphs, { familyName, styleName });
      downloadFont(font, `${familyName.replace(/\s+/g, "-")}.otf`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="panel">
      <h3>3. Preview &amp; export</h3>
      <div className="form-row">
        <label>
          Font family name
          <input value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
        </label>
        <label>
          Style name
          <input value={styleName} onChange={(e) => setStyleName(e.target.value)} />
        </label>
      </div>

      {capturedCount === 0 ? (
        <p className="hint">Draw or trace at least one letter to see a preview.</p>
      ) : (
        <>
          <textarea
            className="preview-text"
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            style={fontReady ? { fontFamily: `"${previewFamily.current}"` } : undefined}
            rows={4}
          />
          {!fontReady && <p className="hint">Building preview…</p>}
        </>
      )}

      {error && <p className="hint result-msg">Error: {error}</p>}

      <button className="btn-primary" onClick={handleExport} disabled={capturedCount === 0}>
        Download font (.otf)
      </button>
    </div>
  );
}
