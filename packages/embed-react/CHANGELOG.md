# @codatum/embed-react

## 0.3.0

### Patch Changes

- dc61a7b: Relax validation: allow `null` for optional options (treated same as undefined).
- a496e63: Add `tokenOptions.disableRefresh` to disable automatic token refresh.
- fb270b3: Add SSR test and pass through container attrs

  - Add `Embed.ssr.test.tsx` to ensure the React component renders with `renderToString` in Node (e.g. Next.js/SSR) without throwing.
  - Pass through additional div attributes (`...rest`) to the container element (e.g. `data-*`, `aria-*`, `id`).

- 1bc90b0: Add `TokenProvider` type to the core SDK.
- 12f4ec1: Add `iframeOptions.attrs` option to set additional HTML attributes on the iframe element.
- 0ee36ad: Add SSR/Node compatibility tests and .nvmrc

  - Add `node.test.ts` in `@codatum/embed` to ensure the package can be imported in Node without `window`/`document` (SSR-safe).
  - Add `Embed.ssr.test.ts` in `@codatum/embed-vue` to verify the Vue component renders with `createSSRApp` + `renderToString` (e.g. Nuxt).
  - Add `.nvmrc` (20.12) to pin Node version for the repo.

- Updated dependencies [dc61a7b]
- Updated dependencies [a496e63]
- Updated dependencies [1bc90b0]
- Updated dependencies [12f4ec1]
- Updated dependencies [0ee36ad]
  - @codatum/embed@0.3.0

## 0.2.0

### Minor Changes

- Add devOptions

### Patch Changes

- Updated dependencies
  - @codatum/embed@0.2.0

## 0.1.2

### Patch Changes

- use pnpm publish not pnpm changeset publish
- Updated dependencies
  - @codatum/embed@0.1.2

## 0.1.1

### Patch Changes

- fix: remove workspace protocol from publish
- Updated dependencies
  - @codatum/embed@0.1.1

## 0.1.0

### Minor Changes

- Initial release for internal testing

### Patch Changes

- Updated dependencies
  - @codatum/embed@0.1.0
