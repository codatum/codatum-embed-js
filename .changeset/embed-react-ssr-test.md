---
"@codatum/embed-react": patch
---

Add SSR test and pass through container attrs

- Add `Embed.ssr.test.tsx` to ensure the React component renders with `renderToString` in Node (e.g. Next.js/SSR) without throwing.
- Pass through additional div attributes (`...rest`) to the container element (e.g. `data-*`, `aria-*`, `id`).
