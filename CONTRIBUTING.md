# Contributing

This document describes how to set up the repository and run development commands. For SDK usage and API, see [README.md](README.md).

## Documentation language

**Documentation in this repository should preferably be written in English** where practical. This includes (but is not limited to):

- README.md and CONTRIBUTING.md
- Inline comments and JSDoc that are part of the public API or intended for contributors
- Commit messages and PR descriptions are also preferred in English for consistency

Code (variable names, types, user-facing strings in the SDK) follows the existing codebase; for docs and contributor-facing text, English is preferred but not strictly required.

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
│   └── embed-vue/      # @codatum/embed-vue (Vue 3 integration)
└── examples/
    ├── server/         # Server-side token issuance (Hono)
    ├── vanilla/        # Vanilla ESM / CDN examples
    └── vue/            # Vue 3 example (@codatum/embed-vue)
```

## Using the examples

The `examples/` directory contains runnable demos for the SDK. Each subfolder has its own setup and run instructions:

- **[examples/server/README.md](examples/server/README.md)** — Hono server that issues signed-embed tokens. Start it first; see its README for per-scenario config (`config.jsonc`).
- **[examples/vanilla/README.md](examples/vanilla/README.md)** — Minimal browser demo (ESM and CDN). Requires the examples server and a built `@codatum/embed` package.
- **[examples/vue/README.md](examples/vue/README.md)** — Vue 3 demo using `@codatum/embed-vue`. Requires the examples server and built `@codatum/embed` and `@codatum/embed-vue` packages.

### Development (dev) workflow

From the **repository root**, run:

```bash
pnpm dev
```

This uses Turborepo to start all dev tasks in parallel:

| Target              | Port  | URL / note |
|---------------------|-------|------------|
| **examples/server** | 3100  | `http://localhost:3100` — token API per scenario (e.g. `/scenario1/config`, `/scenario1/token`). See [examples/server/README.md](examples/server/README.md) for per-scenario `config.jsonc` setup. |
| **examples/vanilla**| 5173  | `http://localhost:5173` — index lists [ESM](http://localhost:5173/esm.html) and [CDN](http://localhost:5173/cdn.html) examples. |
| **examples/vue**    | 5174  | `http://localhost:5174` — Vue 3 example. |
| **packages/embed**  | —     | Watch build (no HTTP server). |
| **packages/embed-vue** | —  | Watch build (no HTTP server). |

- The `dev` task in `turbo.json` is marked **`persistent: true`** so that long-running processes (Vite dev servers, watch scripts) are not closed by Turbo after startup.
- Dependencies are built first (`dependsOn: ["^build"]`); then all dev tasks run. To run a single example, use e.g. `pnpm --filter @examples/vue dev` from the root.

## Working on a single package

To build and test only `packages/embed`:

```bash
cd packages/embed
pnpm build
pnpm test
pnpm run test:watch   # Watch mode
```
