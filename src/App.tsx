import { useState } from "react";
import "./App.css";
import { GlyphStoreProvider, useGlyphStore } from "./state/GlyphStore";
import GlyphGrid from "./components/GlyphGrid";
import TemplateGenerator from "./components/TemplateGenerator";
import TemplateUpload from "./components/TemplateUpload";
import PreviewExport from "./components/PreviewExport";

type Tab = "draw" | "template" | "export";

function ProjectSwitcher() {
  const { projects, activeProjectId, setActiveProjectId, createProject, renameProject, deleteProject } =
    useGlyphStore();

  function handleNew() {
    const name = window.prompt("Name your new font:", "");
    if (name === null) return; // cancelled
    createProject(name);
  }

  function handleRename() {
    const current = projects.find((p) => p.id === activeProjectId);
    if (!current) return;
    const name = window.prompt("Rename this font:", current.name);
    if (name === null) return;
    renameProject(activeProjectId, name);
  }

  function handleDelete() {
    const current = projects.find((p) => p.id === activeProjectId);
    if (!current) return;
    if (confirm(`Delete "${current.name}"? Its captured letters will be lost for good.`)) {
      deleteProject(activeProjectId);
    }
  }

  return (
    <div className="project-switcher">
      <select
        value={activeProjectId}
        onChange={(e) => setActiveProjectId(e.target.value)}
        aria-label="Select font"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({Object.keys(p.glyphs).length})
          </option>
        ))}
      </select>
      <button onClick={handleRename} title="Rename this font">
        Rename
      </button>
      <button onClick={handleNew} title="Start a new font">
        + New font
      </button>
      <button onClick={handleDelete} disabled={projects.length <= 1} title="Delete this font">
        Delete
      </button>
    </div>
  );
}

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
        <ProjectSwitcher />
        <span className="hint">{capturedCount} captured</span>
        <button
          className="btn-danger-outline"
          onClick={() => {
            if (confirm("Clear all captured letters in this font? This cannot be undone.")) clearAll();
          }}
        >
          Clear letters
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
