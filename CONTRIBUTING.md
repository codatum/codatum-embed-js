# Contributing

This document describes how to set up the repository and run development commands. For SDK usage and API, see [README.md](README.md).

## Documentation language

**All documentation in this repository must be written in English.** This includes (but is not limited to):

- README.md and CONTRIBUTING.md
- Inline comments and JSDoc that are part of the public API or intended for contributors
- Commit messages and PR descriptions are recommended to be in English for consistency

Code (variable names, types, user-facing strings in the SDK) follows the existing codebase; documentation and contributor-facing text use English only.

## Prerequisites

- **mise**: Used to manage Node.js and pnpm versions.
  - Install: <https://mise.jdx.dev/getting-started.html>

## Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd codatum-embed-js
```

### 2. Enable tools (mise)

The root `mise.toml` defines the Node.js and pnpm versions. Install and activate them in this directory with:

```bash
mise install
```

This makes the versions specified in `mise.toml` active in this repo:

- Node.js: 24.3.0 (build requires Node.js >= 18)
- pnpm: 10.17.0

### 3. Install dependencies

```bash
pnpm install
```

Dependencies for all workspace packages (`packages/*`) will be installed.

### 4. Verify the build

```bash
pnpm build
```

All packages are built via Turborepo. The main library is `packages/embed` (`@codatum/embed`).

### 5. Run tests

```bash
pnpm test
```

## Development commands

Formatting and linting use [Biome](https://biomejs.dev/). Run these from the **repository root**:

| Command           | Description                          |
|-------------------|--------------------------------------|
| `pnpm build`      | Build all packages                   |
| `pnpm test`       | Run tests for all packages           |
| `pnpm lint`       | Run Biome linter (check only)        |
| `pnpm lint:fix`   | Run Biome linter and apply fixes     |
| `pnpm format`     | Format code with Biome               |
| `pnpm format:check` | Check formatting (no write)        |
| `pnpm check`      | Lint + format check in one run      |
| `pnpm check:fix`  | Lint (with fixes) + format in one run |
| `pnpm clean`      | Remove build outputs                 |

## Package layout

```
codatum-embed-js/
├── mise.toml           # Node.js / pnpm version definitions
├── package.json        # Root (workspace)
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── packages/
│   ├── embed/          # @codatum/embed (core SDK)
│   ├── embed-vue/      # @codatum/embed-vue (future)
│   └── embed-react/    # @codatum/embed-react (future)
└── examples/
    ├── server/         # Server-side token issuance examples
    ├── vanilla/        # core examples
    ├── vue/            # Vue examples
    └── react/          # React examples
```

## Using the examples

The `examples/` directory contains runnable demos for the SDK. Each subfolder has its own setup and run instructions:

- **[examples/server/README.md](examples/server/README.md)** — Hono server that issues signed-embed tokens. Many examples depend on this; run it first and configure `config.json` with your Codatum API credentials.
- **[examples/vanilla/README.md](examples/vanilla/README.md)** — Minimal browser demo (ESM and CDN). Requires the examples server and a built `@codatum/embed` package.

From the repo root:

- **`pnpm dev`** — Runs `dev` in all workspaces (packages + examples) via `turbo run dev`. Dependencies are built first (`dependsOn: ["^build"]`), then package watch builds and example servers start (server 3100, vanilla 5173, vue 5174). See each example README for URLs and setup.

## Working on a single package

To build and test only `packages/embed`:

```bash
cd packages/embed
pnpm build
pnpm test
pnpm run test:watch   # Watch mode
```

## Troubleshooting

### mise versions not active

- Ensure your shell runs `mise activate` (e.g. add `eval "$(mise activate zsh)"` to `.zshrc` or equivalent).
- Run `mise install` again in this directory and confirm `mise.toml` (or `.mise.toml`) is being read.

### Build or test failures

- Run `pnpm install` again, then `pnpm build` and `pnpm test`.
- Check Node.js with `node -v` and ensure it is 18 or higher.

## Design and testing

- **Internal flow**: Init resolves container → creates iframe → listens for `READY_FOR_TOKEN` → calls `tokenProvider` → sends `SET_TOKEN`; then message handler relays `PARAM_CHANGED` / `EXECUTE_SQLS_TRIGGERED`. Auto-refresh re-calls `tokenProvider` and re-sends `SET_TOKEN`. `reload()` does the same and resets the refresh timer. See the implementation in `packages/embed/src` for details.
- **Tests**: Vitest with jsdom. Use spies on `iframe.contentWindow.postMessage` and simulate iframe → parent messages with `window.dispatchEvent(new MessageEvent(...))`. Use `vi.useFakeTimers()` for init timeout and auto-refresh. E2E against a real Codatum iframe is out of scope.

## References

- SDK usage and API: [README.md](README.md)
- Signed embed (Codatum docs): https://docs.codatum.com/sharing/signed-embed
