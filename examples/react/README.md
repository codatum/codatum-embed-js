# React example

Minimal React demo for `@codatum/embed-react`: single-page app with `<EmbedReact>` and the same token flow as the vanilla example.

## Prerequisites

1. Start the [examples server](../server/README.md) first (see its README for setup).
2. **@codatum/embed** and **@codatum/embed-react** must be built:

   ```bash
   pnpm run build --filter @codatum/embed --filter @codatum/embed-react
   ```

## Run

From the repo root:

```bash
pnpm --filter @examples/react dev
```

Then open http://localhost:5175 in the browser.

## Notes

- Fetches config from the examples server (localhost:3100) per scenario (e.g. `/scenario1/config`, `/scenario1/token`), then renders `<EmbedReact>` with a `tokenProvider` that calls the same scenario's token endpoint.
- Callbacks `onParamChanged` and `onExecuteSqlsTriggered` are logged to the console.
