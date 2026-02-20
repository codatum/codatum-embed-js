# Codatum Embed SDK

Monorepo for the Codatum [signed embed](https://docs.codatum.com/sharing/signed-embed) client SDK. Use these packages to embed Codatum Notebook in your app with a token from your backend.

## Packages

| Package | Description |
|---------|-------------|
| [**@codatum/embed**](packages/embed/README.md) | Core TypeScript SDK. Use in the browser or with any framework. |
| [**@codatum/embed-react**](packages/embed-react/README.md) | React 18+ component wrapper for the core SDK. |
| [**@codatum/embed-vue**](packages/embed-vue/README.md) | Vue 3 component wrapper for the core SDK. |

Install the one you need (e.g. `pnpm add @codatum/embed` or `@codatum/embed-react` / `@codatum/embed-vue`). For full API docs, installation, and examples, see each package’s README above.

## Docs

- [Signed embed](https://docs.codatum.com/sharing/signed-embed) · [Integration](https://docs.codatum.com/sharing/signed-embed/integration) · [Use cases](https://docs.codatum.com/sharing/signed-embed/use-case)

## Versioning

We follow [Semantic Versioning](https://semver.org/). Changelogs: [@codatum/embed](packages/embed/CHANGELOG.md) · [@codatum/embed-react](packages/embed-react/CHANGELOG.md) · [@codatum/embed-vue](packages/embed-vue/CHANGELOG.md).

## Security and deployment

- **CSP**: If your app sets Content-Security-Policy, allow `frame-src https://app.codatum.com`.
- **iframe**: The SDK sets `allow="fullscreen; clipboard-write"` on the iframe. Styling defaults to 100% width/height; override with `iframeOptions.style`.

## Supported environments

- Browsers: ES2017+ (Chrome 63+, Firefox 57+, Safari 12+, iOS Safari 12+)
- Module formats: ESM, CJS, IIFE (see CDN in [@codatum/embed](packages/embed/README.md#cdn))

## Contributing

Setup, build, test, and package layout: [CONTRIBUTING](CONTRIBUTING.md).

## License

Apache License 2.0. See [LICENSE](LICENSE).
