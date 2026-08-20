# Handwriting → Font

Turn your own handwriting into a real, installable font (`.otf`). Runs entirely
in the browser — no backend, no server-side processing.

## How it works

1. **Draw letters** — write each character directly on an in-browser canvas
   with your mouse, trackpad, or stylus. Pen strokes are converted to smooth
   vector outlines with [perfect-freehand](https://github.com/steveruizok/perfect-freehand).
2. **Scan template** — alternatively, download a printable template, fill it
   in by hand, and upload a photo or scan. The app aligns your photo using
   three registration marks, slices out each letter's cell, and traces the
   ink into vector outlines with [imagetracerjs](https://github.com/jankovicsandras/imagetracerjs).
3. **Preview & export** — see your handwriting rendered as a live font
   preview, then download a real OpenType font built with
   [opentype.js](https://github.com/opentypejs/opentype.js).

Captured letters are saved to `localStorage`, so you can come back and finish
the set later.

## Development

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```
