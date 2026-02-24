# @codatum/embed

## 0.3.0

### Minor Changes

- a496e63: Add `tokenOptions.disableRefresh` to disable automatic token refresh.
- 12f4ec1: Add `iframeOptions.attrs` option to set additional HTML attributes on the iframe element.

### Patch Changes

- dc61a7b: Relax validation: allow `null` for optional options (treated same as undefined).
- 1bc90b0: Add `TokenProvider` type to the core SDK.
- 0ee36ad: Add SSR/Node compatibility tests and .nvmrc

  - Add `node.test.ts` in `@codatum/embed` to ensure the package can be imported in Node without `window`/`document` (SSR-safe).
  - Add `Embed.ssr.test.ts` in `@codatum/embed-vue` to verify the Vue component renders with `createSSRApp` + `renderToString` (e.g. Nuxt).
  - Add `.nvmrc` (20.12) to pin Node version for the repo.

## 0.2.0

### Minor Changes

- Add devOptions

## 0.1.2

### Patch Changes

- use pnpm publish not pnpm changeset publish

## 0.1.1

### Patch Changes

- fix: remove workspace protocol from publish

## 0.1.0

### Minor Changes

- Initial release for internal testing
