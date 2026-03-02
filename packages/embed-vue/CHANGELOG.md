# @codatum/embed-vue

## 0.5.0

### Minor Changes

- Expose 2 new events to external consumers: `executionSucceeded` and `executionFailed`. These are now emitted from the embed instance (core: `embed.on(event, handler)`; React: `onExecutionSucceeded` / `onExecutionFailed`;

### Patch Changes

- Updated dependencies
  - @codatum/embed@0.5.0

## 0.4.0

### Minor Changes

- 131a1d2: ### Features

  **Custom loading UI based on embed status**

  - **@codatum/embed**: Set `data-codatum-embed-status` on the container element so you can target status (e.g. `INITIALIZING`, `RELOADING`, `REFRESHING`, `READY`) from CSS or E2E selectors. Enables custom loading UI by hiding the iframe and showing your own content while loading (see README "Custom loading UI").
  - **@codatum/embed-vue**: Add `#loading` slot and `showLoadingOn` so you can show custom UI as an overlay while loading; default `showLoadingOn` is `['INITIALIZING', 'RELOADING', 'REFRESHING']`. Slot receives `{ status }` for branching.

- 981dc5a: ### Breaking

  **Status behavior changes**

  - INITIALIZING semantics: the embed now waits for the iframe's `CONTENT_READY` before transitioning to READY (previously it became READY right after sending the token).
  - RELOADING / REFRESHING added: status is `RELOADING` during `reload()` and `REFRESHING` during token auto-refresh. In both cases the embed becomes READY only after receiving `CONTENT_READY`.
  - In `tokenOptions`, `initTimeout` has been renamed to `loadingTimeout`. It is used as the timeout (seconds) while waiting for `CONTENT_READY` on init, reload, and refresh. On timeout, `LOADING_TIMEOUT` is raised (on init, the embed is destroyed).

  **statusChanged added**

  - Vue and React: removed `ready` (`onReady` prop / `ready` emit) and unified on `statusChanged`; use `payload.status === 'READY'` for "embed ready".

### Patch Changes

- Updated dependencies [131a1d2]
- Updated dependencies [eec5f31]
- Updated dependencies [981dc5a]
  - @codatum/embed@0.4.0

## 0.3.0

### Patch Changes

- dc61a7b: Relax validation: allow `null` for optional options (treated same as undefined).
- a496e63: Add `tokenOptions.disableRefresh` to disable automatic token refresh.
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
