import { useState } from "react";
import "./App.css";
import { GlyphStoreProvider, useGlyphStore } from "./state/GlyphStore";
import GlyphGrid from "./components/GlyphGrid";
import TemplateGenerator from "./components/TemplateGenerator";
import TemplateUpload from "./components/TemplateUpload";
import PreviewExport from "./components/PreviewExport";

type Tab = "draw" | "template" | "export";

function TopBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { capturedCount, clearAll } = useGlyphStore();
  return (
    <header className="topbar">
      <h1>Handwriting → Font</h1>
      <nav className="tabs">
        <button className={tab === "draw" ? "active" : ""} onClick={() => setTab("draw")}>
          Draw letters
        </button>
        <button className={tab === "template" ? "active" : ""} onClick={() => setTab("template")}>
          Scan template
        </button>
        <button className={tab === "export" ? "active" : ""} onClick={() => setTab("export")}>
          Preview &amp; export
        </button>
      </nav>
      <div className="topbar-right">
        <span className="hint">{capturedCount} captured</span>
        <button
          className="btn-danger-outline"
          onClick={() => {
            if (confirm("Clear all captured letters? This cannot be undone.")) clearAll();
          }}
        >
          Reset all
        </button>
      </div>
    </header>
  );
}

function AppInner() {
  const [tab, setTab] = useState<Tab>("draw");
  return (
    <div className="app">
      <TopBar tab={tab} setTab={setTab} />
      <main className="main">
        {tab === "draw" && <GlyphGrid />}
        {tab === "template" && (
          <div className="template-tab">
            <TemplateGenerator />
            <TemplateUpload />
          </div>
        )}
        {tab === "export" && <PreviewExport />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <GlyphStoreProvider>
      <AppInner />
    </GlyphStoreProvider>
  );
}
