---
"@codatum/embed": minor
"@codatum/embed-react": minor
"@codatum/embed-vue": minor
---

### Breaking

**Status behavior changes**

- INITIALIZING semantics: the embed now waits for the iframe's `CONTENT_READY` before transitioning to READY (previously it became READY right after sending the token).
- RELOADING / REFRESHING added: status is `RELOADING` during `reload()` and `REFRESHING` during token auto-refresh. In both cases the embed becomes READY only after receiving `CONTENT_READY`.
- In `tokenOptions`, `initTimeout` has been renamed to `loadingTimeout`. It is used as the timeout (seconds) while waiting for `CONTENT_READY` on init, reload, and refresh. On timeout, `LOADING_TIMEOUT` is raised (on init, the embed is destroyed).

**statusChanged added**

- Vue and React: removed `ready` (`onReady` prop / `ready` emit) and unified on `statusChanged`; use `payload.status === 'READY'` for "embed ready".
