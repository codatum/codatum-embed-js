# Vanilla example

Minimal browser demo for `@codatum/embed`: ESM and CDN (IIFE) usage.

## Prerequisites

1. **Examples server** must be running with a valid `config.json` (see [examples/server/README.md](../server/README.md)).
2. **@codatum/embed** must be built (required for the CDN page and for ESM resolution):

   ```bash
   pnpm --filter @codatum/embed build
   ```

## Run

From the repo root:

```bash
pnpm --filter @examples/vanilla dev
```

Then open in the browser:

- **ESM**: http://localhost:5173/esm.html — uses `import` from `@codatum/embed`.
- **CDN**: http://localhost:5173/cdn.html — uses the IIFE bundle (local build or comment for unpkg URL).

## Pages

- **esm.html** — Entry point is `src/main.ts`. Fetches `/config` from the examples server, then calls `createEmbed()` and `embed.init()` with a `tokenProvider` that calls `/token`. Includes `paramChanged` / `executeSqlsTriggered` logging and commented ParamMapper usage.
- **cdn.html** — Standalone HTML that loads the embed script from the local build (`../../packages/embed/dist/index.global.min.js`). Same flow: `/config` → `CodatumEmbed.createEmbed()` then `embed.init()` with `/token` as session provider. Can also be opened as a file or served by another static server if the script path is valid.

## Notes

- The dev server serves the embed IIFE at `/packages/embed/dist/index.global.min.js` so that `cdn.html` works without opening the repo from the filesystem.
- For production CDN usage, use the URL commented in `cdn.html` (e.g. unpkg) instead of the local path.
