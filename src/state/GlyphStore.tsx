import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import opentype from "opentype.js";
import type { RawPath } from "../lib/rawPath";

const STORAGE_KEY = "handwriting-font-glyphs-v1";

type SerializedGlyphs = Record<string, opentype.PathCommand[]>;

function loadFromStorage(): Record<string, RawPath> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: SerializedGlyphs = JSON.parse(raw);
    const result: Record<string, RawPath> = {};
    for (const [char, commands] of Object.entries(parsed)) {
      const path = new opentype.Path();
      path.commands = commands;
      result[char] = path;
    }
    return result;
  } catch {
    return {};
  }
}

function saveToStorage(glyphs: Record<string, RawPath>) {
  const serialized: SerializedGlyphs = {};
  for (const [char, path] of Object.entries(glyphs)) {
    serialized[char] = path.commands;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // storage full/unavailable — ignore, in-memory state still works
  }
}

interface GlyphStoreValue {
  glyphs: Record<string, RawPath>;
  setGlyph: (char: string, path: RawPath) => void;
  clearGlyph: (char: string) => void;
  clearAll: () => void;
  isCaptured: (char: string) => boolean;
  capturedCount: number;
}

const GlyphStoreContext = createContext<GlyphStoreValue | null>(null);

export function GlyphStoreProvider({ children }: { children: React.ReactNode }) {
  const [glyphs, setGlyphs] = useState<Record<string, RawPath>>(() => loadFromStorage());

  useEffect(() => {
    saveToStorage(glyphs);
  }, [glyphs]);

  const setGlyph = useCallback((char: string, path: RawPath) => {
    setGlyphs((prev) => ({ ...prev, [char]: path }));
  }, []);

  const clearGlyph = useCallback((char: string) => {
    setGlyphs((prev) => {
      const next = { ...prev };
      delete next[char];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setGlyphs({});
  }, []);

  const isCaptured = useCallback((char: string) => !!glyphs[char] && glyphs[char].commands.length > 0, [glyphs]);

  const capturedCount = useMemo(
    () => Object.values(glyphs).filter((p) => p.commands.length > 0).length,
    [glyphs]
  );

  const value = useMemo(
    () => ({ glyphs, setGlyph, clearGlyph, clearAll, isCaptured, capturedCount }),
    [glyphs, setGlyph, clearGlyph, clearAll, isCaptured, capturedCount]
  );

  return <GlyphStoreContext.Provider value={value}>{children}</GlyphStoreContext.Provider>;
}

export function useGlyphStore(): GlyphStoreValue {
  const ctx = useContext(GlyphStoreContext);
  if (!ctx) throw new Error("useGlyphStore must be used within GlyphStoreProvider");
  return ctx;
}
