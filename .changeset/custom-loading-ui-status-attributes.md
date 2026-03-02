---
"@codatum/embed": minor
"@codatum/embed-react": minor
"@codatum/embed-vue": minor
---

### Features

**Custom loading UI based on embed status**

- **@codatum/embed**: Set `data-codatum-embed-status` on the container element so you can target status (e.g. `INITIALIZING`, `RELOADING`, `REFRESHING`, `READY`) from CSS or E2E selectors. Enables custom loading UI by hiding the iframe and showing your own content while loading (see README "Custom loading UI").
- **@codatum/embed-react**: Add `renderLoading` and `showLoadingOn` so you can show custom UI while loading; default `showLoadingOn` is `['INITIALIZING', 'RELOADING', 'REFRESHING']`. You can branch by `status` in `renderLoading({ status })`.
- **@codatum/embed-vue**: Add `#loading` slot and `showLoadingOn` so you can show custom UI as an overlay while loading; default `showLoadingOn` is `['INITIALIZING', 'RELOADING', 'REFRESHING']`. Slot receives `{ status }` for branching.

