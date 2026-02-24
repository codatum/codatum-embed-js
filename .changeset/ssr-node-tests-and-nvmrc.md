---
"@codatum/embed": patch
"@codatum/embed-react": patch
"@codatum/embed-vue": patch
---

Add SSR/Node compatibility tests and .nvmrc

- Add `node.test.ts` in `@codatum/embed` to ensure the package can be imported in Node without `window`/`document` (SSR-safe).
- Add `Embed.ssr.test.ts` in `@codatum/embed-vue` to verify the Vue component renders with `createSSRApp` + `renderToString` (e.g. Nuxt).
- Add `.nvmrc` (20.12) to pin Node version for the repo.
