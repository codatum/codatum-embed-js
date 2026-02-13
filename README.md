# @codatum/embed

TypeScript library for embedding Codatum Notebook with [signed embed](https://docs.codatum.com/sharing/signed-embed). Use it in the browser to create the iframe, pass a token from your backend, and handle parameters and events. Server-side token issuance is out of scope.

- **Docs**: [Signed embed](https://docs.codatum.com/sharing/signed-embed) · [Integration](https://docs.codatum.com/sharing/signed-embed/integration) · [Use cases](https://docs.codatum.com/sharing/signed-embed/use-case)
- **Vue 3**: [@codatum/embed-vue](packages/embed-vue/README.md) — component wrapper for the core SDK

## Installation

```bash
pnpm add @codatum/embed
# or
npm install @codatum/embed
```

## Quick start

```ts
import { CodatumEmbed } from '@codatum/embed';

const embed = await CodatumEmbed.init({
  container: '#dashboard',
  embedUrl: 'https://app.codatum.com/protected/workspace/xxx/notebook/yyy',
  tokenProvider: async () => {
    const res = await fetch('/api/codatum/token', { method: 'POST' });
    return (await res.json()).token;
  },
  iframeOptions: { theme: 'LIGHT', locale: 'ja', style: { height: '600px' } },
});

// Optional: listen for parameter changes
embed.on('paramChanged', (payload) => console.log('Params:', payload.params));

// Cleanup when done
embed.destroy();
```

## API overview

### `CodatumEmbed.init(options): Promise<CodatumEmbedInstance>`

Creates the iframe, waits for the embed to be ready, gets a token from `tokenProvider`, and sends it. Throws `CodatumEmbedError` on failure.

| Option | Required | Description |
|--------|----------|-------------|
| `container` | Yes | `HTMLElement` or CSS selector where the iframe is inserted |
| `embedUrl` | Yes | Signed embed URL from Codatum |
| `tokenProvider` | Yes | `() => Promise<string>`. Called on init, on auto-refresh, and when `reload()` is used |
| `iframeOptions` | No | See [iframeOptions](#iframeoptions) below |
| `tokenOptions` | No | See [tokenOptions](#tokenoptions) below |
| `clientSideOptions` | No | See [clientSideOptions](#clientsideoptions) below |

#### iframeOptions

Options applied to the iframe element and passed to the embed via URL/search params.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `theme` | `'LIGHT'` \| `'DARK'` | Browser's system theme | UI theme of the embedded notebook |
| `locale` | `string` | Browser's locale | Locale code (e.g. `'en'`, `'ja'`) for the embed UI |
| `className` | `string` | - | CSS class name(s) applied to the iframe element |
| `style` | `object` | `{width: '100%', height: '100%', border: 'none'}` | Inline styles for the iframe; overrides the default styles |

#### tokenOptions

Controls token lifetime, refresh behavior, and init timeout.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `expiresIn` | `number` | `3600` | Expected token TTL in seconds; used to schedule auto-refresh |
| `refreshBuffer` | `number` | `300` | Seconds before expiry to trigger refresh (e.g. 300 = refresh 5 min before) |
| `retryCount` | `number` | `2` | Number of retries on token fetch failure; `0` = no retry |
| `initTimeout` | `number` | `30000` | Max wait in ms for embed "ready"; `0` = no timeout |
| `onRefreshed` | `() => void` | `undefined` | Callback when token is successfully refreshed |
| `onRefreshError` | `(error: Error) => void` | `undefined` | Callback when refresh or token fetch fails |

#### clientSideOptions

Sent to the embed with the token (SET_TOKEN message). Can be updated via `reload(clientSideOptions)`.

| Property | Type | Description |
|----------|------|-------------|
| `displayOptions` | `object` | See [displayOptions](#displayoptions) below |
| `params` | `EncodedParam[]` | Initial/override parameter values; use ParamHelper `encode()` to build |

##### displayOptions

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sqlDisplay` | `'SHOW'` \| `'RESULT_ONLY'` \| `'HIDE'` | `'SHOW'` | Whether to show SQL editor, results only, or hide |
| `hideParamsForm` | `boolean` | `false` | Hide the parameter form in the embed (e.g. when your app owns the filters) |
| `expandParamsFormByDefault` | `boolean` | `false` | Whether the parameter form is expanded by default |

### Instance methods

- **`reload(clientSideOptions?)`** — Re-fetches token and sends `SET_TOKEN`. No arg: reuse current `clientSideOptions`. With arg: use new options (e.g. update params). Resets auto-refresh. `Promise<void>`.
- **`on(event, handler)`** / **`off(event, handler)`** — Subscribe to `paramChanged` and `executeSqlsTriggered` (postMessage payloads from the iframe).
- **`destroy()`** — Removes iframe, clears listeners and timers. No-op if already destroyed.

### Instance properties

- **`iframe`** — `HTMLIFrameElement | null`
- **`status`** — `'initializing' | 'ready' | 'destroyed'`

### Errors

All errors are thrown/rejected as `CodatumEmbedError` with `code`:

| Code | When |
|------|------|
| `CONTAINER_NOT_FOUND` | Container element not found at init |
| `INVALID_OPTIONS` | `init`, `reload` options are invalid |
| `INIT_TIMEOUT` | Ready not received within `tokenOptions.initTimeout` |
| `TOKEN_PROVIDER_FAILED` | `tokenProvider` threw (init or reload) |

## ParamHelper

Use `CodatumEmbed.createParamHelper(paramDefs)` to map alias names to Codatum `param_id`s (from the admin UI), then `encode`/`decode` for `clientSideOptions.params` and event payloads.

```ts
import { CodatumEmbed } from '@codatum/embed';

const paramHelper = CodatumEmbed.createParamHelper({
  store_id: '67a1b2c3d4e5f6a7b8c9d0e1',
  date_range: '67a1b2c3d4e5f6a7b8c9d0e2',
  product_category: '67a1b2c3d4e5f6a7b8c9d0e3',
});

const embed = await CodatumEmbed.init({
  container: '#dashboard',
  embedUrl: '...',
  tokenProvider: async () => { /* ... */ },
  clientSideOptions: {
    params: paramHelper.encode(
      {
        store_id: 'store_001',
        date_range: ['2025-01-01', '2025-01-31'],
        product_category: [],
      },
      { hidden: ['store_id'] },
    ),
  },
});

embed.on('paramChanged', (payload) => {
  const values = paramHelper.decode(payload.params);
  // { store_id, date_range, product_category }
});

await embed.reload({
  params: paramHelper.encode({
    store_id: 'store_002',
    date_range: ['2025-02-01', '2025-02-28'],
    product_category: ['electronics'],
  }),
});
```

- **`encode(values, options?)`** — Alias + values → `EncodedParam[]`. `options.hidden` marks params as hidden. All keys in `paramDefs` must be provided.
- **`decode(params)`** — `EncodedParam[]` → alias + parsed values. Unknown `param_id`s are ignored.

## Usage examples

### Basic (params form in embed)

```ts
const paramHelper = CodatumEmbed.createParamHelper({
  date_range: '67a1b2c3d4e5f6a7b8c9d0e1',
  product_category: '67a1b2c3d4e5f6a7b8c9d0e2',
  store_id: '67a1b2c3d4e5f6a7b8c9d0e3',
});

const embed = await CodatumEmbed.init({
  container: '#dashboard',
  embedUrl: 'https://app.codatum.com/protected/workspace/xxx/notebook/yyy',
  iframeOptions: { theme: 'LIGHT', locale: 'ja', style: { height: '600px' } },
  tokenProvider: async () => {
    const res = await fetch('/api/codatum/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: currentUser.tenantId, store_id: currentUser.defaultStoreId }),
    });
    return (await res.json()).token;
  },
  tokenOptions: {
    expiresIn: 3600,
    refreshBuffer: 300,
    onRefreshError: () => { window.location.href = '/login'; },
  },
  clientSideOptions: {
    params: paramHelper.encode({
      date_range: '_RESET_TO_DEFAULT_',
      product_category: [],
      store_id: currentUser.defaultStoreId,
    }),
  },
});

embed.on('paramChanged', (payload) => {
  const values = paramHelper.decode(payload.params);
  console.log('Changed:', values);
});
```

### Client-side params only (SaaS manages filters, hide params form)

```ts
const embed = await CodatumEmbed.init({
  container: '#dashboard',
  embedUrl: '...',
  iframeOptions: { theme: 'LIGHT', locale: 'ja' },
  tokenProvider: async () => {
    const res = await fetch('/api/codatum/token', { method: 'POST', ... });
    return (await res.json()).token;
  },
  clientSideOptions: {
    displayOptions: { hideParamsForm: true },
    params: paramHelper.encode(
      { store_id: currentStoreId, date_range: ['2025-01-01', '2025-01-31'], product_category: [] },
      { hidden: ['store_id'] },
    ),
  },
});

async function onFilterChange(storeId: string, dateRange: [string, string]) {
  await embed.reload({
    displayOptions: { hideParamsForm: true },
    params: paramHelper.encode(
      { store_id: storeId, date_range: dateRange, product_category: [] },
      { hidden: ['store_id'] },
    ),
  });
}
```

### Server-side parameter change (token re-issue)

```ts
let currentStoreId = 'store_001';

const embed = await CodatumEmbed.init({
  container: '#dashboard',
  embedUrl: '...',
  tokenProvider: async () => {
    const res = await fetch('/api/codatum/token', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: currentUser.tenantId, store_id: currentStoreId }),
    });
    return (await res.json()).token;
  },
  clientSideOptions: {
    params: paramHelper.encode({
      date_range: '_RESET_TO_DEFAULT_',
      product_category: [],
      store_id: currentStoreId,
    }),
  },
});

let latestValues = paramHelper.decode([]);
embed.on('paramChanged', (payload) => { latestValues = paramHelper.decode(payload.params); });

async function onStoreSwitch(storeId: string) {
  currentStoreId = storeId;
  await embed.reload({
    params: paramHelper.encode({ ...latestValues, store_id: storeId }),
  });
}
```

### Multiple notebooks

```ts
const [salesDashboard, supportDashboard] = await Promise.all([
  CodatumEmbed.init({
    container: '#sales',
    embedUrl: 'https://app.codatum.com/.../notebook/aaa',
    tokenProvider: () => fetchToken('aaa'),
  }),
  CodatumEmbed.init({
    container: '#support',
    embedUrl: 'https://app.codatum.com/.../notebook/bbb',
    tokenProvider: () => fetchToken('bbb'),
  }),
]);
```

## CDN

```html
<script src="https://unpkg.com/@codatum/embed/dist/index.global.min.js"></script>
<script>
  CodatumEmbed.init({ container: '#dashboard', embedUrl: '...', tokenProvider: async () => '...' });
</script>
```

## Security and deployment

- **CSP**: If your app sets Content-Security-Policy, allow `frame-src https://app.codatum.com`.
- **iframe**: The SDK sets `allow="fullscreen; clipboard-write"` on the iframe. Styling defaults to 100% width/height; override with `iframeOptions.style`.

## Supported environments

- Browsers: ES2017+ (Chrome 63+, Firefox 57+, Safari 12+, iOS Safari 12+)
- Module formats: ESM, CJS, IIFE (see CDN)
- No polyfills shipped; the SDK uses only `postMessage`, `addEventListener`, `Promise`, `setTimeout`, `URL`, and `document.querySelector`

## Contributing

Setup, build, test, and package layout: [CONTRIBUTING.md](CONTRIBUTING.md).
