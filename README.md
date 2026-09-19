# WinKit

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Everyday file tools that run 100% in your browser. Convert, compress, merge, extract. 57 tools, no uploads, no accounts. UI in Indonesian and English.

## Run it

Website:

```bash
npm install
npm run build:web
npm run serve:web   # http://localhost:4173
```

Chrome extension (Manifest V3):

```bash
npm run build   # outputs to dist/
```

Then open `chrome://extensions`, turn on Developer mode, Load unpacked, pick `dist/`.

## How the code is organized

- `src/processors/` - one file per domain (image, pdf, video, audio, document, archive). Pure logic, no UI.
- `src/components/ToolRunner.tsx` - every file tool goes through here: validate, process, download.
- `src/shared/tools.ts` - the tool registry. A new tool is an entry here plus a processor and a config panel.
- `src/shared/validation.ts` - file extensions are never trusted on their own. Every file is checked by magic bytes before anything touches it.
- `server/` - optional self-hosted helper (ffmpeg/soffice/qpdf) for jobs browsers cannot do. Off unless you configure it.

Two tools only work on the website (`video-convert`, `video-trim`). FFmpeg needs SharedArrayBuffer, which extension pages cannot get. Everything else runs in both targets.

## Tests

```bash
npm test
```

Tests use real fixture files under `test/fixtures/` (actual mp4, zip, docx, and friends, all tiny). Regenerate them with:

```bash
node scripts/make-fixtures.mjs   # needs ffmpeg on PATH
node scripts/make-icons.mjs      # rebuild icons from logo/logo.png
```

## Deploy the website (Cloudflare Pages)

1. Push to GitHub.
2. Cloudflare dashboard, Workers and Pages, Create, Pages, Connect to Git.
3. Build command `npm run build:web`, output directory `dist-web`, Node 20 or newer.
4. `_headers` is already in the build output, so COOP/COEP headers are sent and FFmpeg runs multi-threaded. To confirm on the live URL, open DevTools and check that `crossOriginIsolated` is `true`.
5. Any static host works, but without those headers video transcode drops to single-thread. Still works, just slower.
6. OCR downloads its language data from a CDN on first use, then caches it. Everything else works fully offline.

## What does not work (and why)

- Password-protected PDFs are rejected with a clear message. There is no in-browser engine for them.
- Old `.doc` files are rejected. Use `.docx`.
- AVI and other exotic codecs cannot be decoded by browsers. On the website, convert to MP4 first with the Video Convert tool.
- Word to PDF keeps text, font sizes, bold/italic, alignment, lists, tables, and inline images. Text color and complex layout get simplified.
- Without COOP/COEP headers (see Deploy), FFmpeg falls back to single-thread.

## License

[MIT](LICENSE).
