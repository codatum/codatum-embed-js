---
"@codatum/embed": minor
"@codatum/embed-react": minor
"@codatum/embed-vue": minor
---

**Breaking**

- **Embed status value:** `EmbedStatus` and `statusChanged` payload now use `'LOADING'` instead of `'INITIALIZING'`. Update any checks on `instance.status`, `payload.status`, or `payload.previousStatus` (e.g. `status === 'INITIALIZING'` → `status === 'LOADING'`).
- **@codatum/embed-react:** Removed `onReady` prop. Use `onStatusChanged` and check `payload.status === 'READY'` for "embed ready".
- **@codatum/embed-vue:** Removed `ready` emit. Use `@statusChanged` and check `payload.status === 'READY'` for "embed ready".
- **@codatum/embed:** Added tests for `statusChanged` (init CREATED→LOADING→READY, destroy READY→DESTROYED, on/off, multiple handlers).
