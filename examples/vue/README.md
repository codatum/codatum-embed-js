# Vue example

Minimal Vue 3 demo for `@codatum/embed-vue`: single-page app with `<EmbedVue>` and the same token flow as the vanilla example.

## Prerequisites

1. Start the [examples server](../server/README.md) first (see its README for setup).
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

- Fetches config from the examples server (localhost:3100) per scenario (e.g. `/scenario1/config`, `/scenario1/token`), then renders `<EmbedVue>` with a `tokenProvider` that calls the same scenario’s token endpoint.
- Events `paramChanged` and `executeSqlsTriggered` are logged to the console.
