import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import opentype from "opentype.js";
import type { RawPath } from "../lib/rawPath";

const STORAGE_KEY = "handwriting-font-projects-v1";
const LEGACY_STORAGE_KEY = "handwriting-font-glyphs-v1";
const DEFAULT_PROJECT_NAME = "My Handwriting";

type SerializedGlyphs = Record<string, opentype.PathCommand[]>;

export interface FontProject {
  id: string;
  name: string;
  glyphs: Record<string, RawPath>;
  createdAt: number;
  updatedAt: number;
}

interface SerializedProject {
  id: string;
  name: string;
  glyphs: SerializedGlyphs;
  createdAt: number;
  updatedAt: number;
}

interface ProjectsFile {
  projects: SerializedProject[];
  activeProjectId: string;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function deserializeGlyphs(glyphs: SerializedGlyphs): Record<string, RawPath> {
  const result: Record<string, RawPath> = {};
  for (const [char, commands] of Object.entries(glyphs)) {
    const path = new opentype.Path();
    path.commands = commands;
    result[char] = path;
  }
  return result;
}

function serializeGlyphs(glyphs: Record<string, RawPath>): SerializedGlyphs {
  const result: SerializedGlyphs = {};
  for (const [char, path] of Object.entries(glyphs)) {
    result[char] = path.commands;
  }
  return result;
}

function freshProject(name: string): FontProject {
  const now = Date.now();
  return { id: newId(), name, glyphs: {}, createdAt: now, updatedAt: now };
}

function loadProjects(): { projects: FontProject[]; activeProjectId: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: ProjectsFile = JSON.parse(raw);
      const projects = parsed.projects.map((p) => ({ ...p, glyphs: deserializeGlyphs(p.glyphs) }));
      if (projects.length > 0) {
        const activeProjectId = projects.some((p) => p.id === parsed.activeProjectId)
          ? parsed.activeProjectId
          : projects[0].id;
        return { projects, activeProjectId };
      }
    }
  } catch {
    // fall through to legacy migration / fresh default below
  }

  // Migrate a pre-multi-project save, if one exists, into a single named
  // project so nobody's earlier work disappears.
  try {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacyGlyphs: SerializedGlyphs = JSON.parse(legacyRaw);
      if (Object.keys(legacyGlyphs).length > 0) {
        const project = { ...freshProject(DEFAULT_PROJECT_NAME), glyphs: deserializeGlyphs(legacyGlyphs) };
        return { projects: [project], activeProjectId: project.id };
      }
    }
  } catch {
    // ignore, fall through to fresh default
  }

  const project = freshProject(DEFAULT_PROJECT_NAME);
  return { projects: [project], activeProjectId: project.id };
}

function saveProjects(projects: FontProject[], activeProjectId: string) {
  const serialized: ProjectsFile = {
    projects: projects.map((p) => ({ ...p, glyphs: serializeGlyphs(p.glyphs) })),
    activeProjectId,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // storage full/unavailable — ignore, in-memory state still works
  }
}

function nextDefaultName(existing: FontProject[]): string {
  const base = "Untitled Handwriting";
  const taken = new Set(existing.map((p) => p.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

interface GlyphStoreValue {
  // Active project's glyphs, for components that only care about drawing.
  glyphs: Record<string, RawPath>;
  setGlyph: (char: string, path: RawPath) => void;
  clearGlyph: (char: string) => void;
  clearAll: () => void;
  isCaptured: (char: string) => boolean;
  capturedCount: number;

  // Multi-font project management.
  projects: FontProject[];
  activeProjectId: string;
  activeProject: FontProject;
  setActiveProjectId: (id: string) => void;
  createProject: (name?: string) => void;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
}

const GlyphStoreContext = createContext<GlyphStoreValue | null>(null);

export function GlyphStoreProvider({ children }: { children: React.ReactNode }) {
  const [{ projects, activeProjectId }, setState] = useState(() => loadProjects());

  useEffect(() => {
    saveProjects(projects, activeProjectId);
  }, [projects, activeProjectId]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? projects[0],
    [projects, activeProjectId]
  );

  const updateActiveProject = useCallback(
    (update: (p: FontProject) => FontProject) => {
      setState((prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === prev.activeProjectId ? { ...update(p), updatedAt: Date.now() } : p
        ),
      }));
    },
    []
  );

  const setGlyph = useCallback(
    (char: string, path: RawPath) => {
      updateActiveProject((p) => ({ ...p, glyphs: { ...p.glyphs, [char]: path } }));
    },
    [updateActiveProject]
  );

  const clearGlyph = useCallback(
    (char: string) => {
      updateActiveProject((p) => {
        const glyphs = { ...p.glyphs };
        delete glyphs[char];
        return { ...p, glyphs };
      });
    },
    [updateActiveProject]
  );

  const clearAll = useCallback(() => {
    updateActiveProject((p) => ({ ...p, glyphs: {} }));
  }, [updateActiveProject]);

  const isCaptured = useCallback(
    (char: string) => !!activeProject.glyphs[char] && activeProject.glyphs[char].commands.length > 0,
    [activeProject]
  );

  const capturedCount = useMemo(
    () => Object.values(activeProject.glyphs).filter((p) => p.commands.length > 0).length,
    [activeProject]
  );

  const setActiveProjectId = useCallback((id: string) => {
    setState((prev) => (prev.projects.some((p) => p.id === id) ? { ...prev, activeProjectId: id } : prev));
  }, []);

  const createProject = useCallback((name?: string) => {
    setState((prev) => {
      const project = freshProject(name?.trim() || nextDefaultName(prev.projects));
      return { projects: [...prev.projects, project], activeProjectId: project.id };
    });
  }, []);

  const renameProject = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, name: trimmed, updatedAt: Date.now() } : p)),
    }));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setState((prev) => {
      if (prev.projects.length <= 1) return prev; // always keep at least one font
      const projects = prev.projects.filter((p) => p.id !== id);
      const activeProjectId = prev.activeProjectId === id ? projects[0].id : prev.activeProjectId;
      return { projects, activeProjectId };
    });
  }, []);

  const value = useMemo(
    () => ({
      glyphs: activeProject.glyphs,
      setGlyph,
      clearGlyph,
      clearAll,
      isCaptured,
      capturedCount,
      projects,
      activeProjectId,
      activeProject,
      setActiveProjectId,
      createProject,
      renameProject,
      deleteProject,
    }),
    [
      activeProject,
      setGlyph,
      clearGlyph,
      clearAll,
      isCaptured,
      capturedCount,
      projects,
      activeProjectId,
      setActiveProjectId,
      createProject,
      renameProject,
      deleteProject,
    ]
  );

  return <GlyphStoreContext.Provider value={value}>{children}</GlyphStoreContext.Provider>;
}

export function useGlyphStore(): GlyphStoreValue {
  const ctx = useContext(GlyphStoreContext);
  if (!ctx) throw new Error("useGlyphStore must be used within GlyphStoreProvider");
  return ctx;
}
