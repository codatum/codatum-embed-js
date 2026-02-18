# Vue example

Minimal Vue 3 demo for `@codatum/embed-vue`: single-page app with `<EmbedVue>` and the same token flow as the vanilla example.

## Prerequisites

1. **Examples server** must be running with a valid `config.json` (see [examples/server/README.md](../server/README.md)).
2. **@codatum/embed** and **@codatum/embed-vue** must be built:

   ```bash
   pnpm run build --filter @codatum/embed --filter @codatum/embed-vue
   ```

## Run

From the repo root:

```bash
pnpm --filter @examples/vue dev
```

Then open http://localhost:5174 in the browser.

## Notes

- Fetches `/config` from the examples server (localhost:3100), then renders `<EmbedVue>` with a `tokenProvider` that calls `/token`.
- Events `paramChanged` and `executeSqlsTriggered` are logged to the console.
