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
    // Issue a token in your backend and fetch it here
    const res = await fetch('/api/codatum/token', { method: 'POST' });
    const data = await res.json();
    return { token: data.token };
  },
});

// cleanup
embed.destroy();
```

## API overview

### Initialization

**`CodatumEmbed.init(options: CodatumEmbedOptions): Promise<CodatumEmbedInstance>`**

Creates the iframe, waits for the iframe to be ready, gets a token and params from `tokenProvider`, and sends token (and optional params) to the iframe. Throws `CodatumEmbedError` on failure.

#### `CodatumEmbedOptions`

| Property | Required | Description |
|--------|----------|-------------|
| `container` | Yes | `HTMLElement` or CSS selector where the iframe is inserted |
| `embedUrl` | Yes | Signed embed URL from Codatum |
| `tokenProvider` | Yes | See [tokenProvider](#tokenprovider) below |
| `iframeOptions` | No | See [IframeOptions](#iframeoptions) below |
| `tokenOptions` | No | See [TokenOptions](#tokenoptions) below |
| `displayOptions` | No | See [DisplayOptions](#displayoptions) below |

#### `tokenProvider`

Required callback that issues a token from your backend and returns it (and optionally `params`). Called on `init()`, `reload()`, and when the token is auto-refreshed — `tokenOptions.refreshBuffer` seconds before the token expires.

**Signature:** `(context: TokenProviderContext) => Promise<{ token: string; params?: EncodedParam[] }>`

- **`context.trigger`** — `'INIT'` | `'RELOAD'` | `'REFRESH'`.
- **`context.markNonRetryable()`** — Call on failure to skip retries (ignores `tokenOptions.retryCount`).
- **`params`** — Optional. If returned, sent to the embed with the token; use [ParamMapper](#parammapper) `encode()` to build.

**Example (token + params, with context):**

```ts
tokenProvider: async (context) => {
  const res = await fetch('/api/codatum/token', {
    method: 'POST',
    body: JSON.stringify({ tenant_id: currentUser.tenantId }),
  });
  if (!res.ok) {
    if (res.status === 401) context.markNonRetryable();
    throw new Error(`Token failed: ${res.status}`);
  }
  const data = await res.json();
  const params = paramMapper.encode({ 
    store_id: currentUser.defaultStoreId,
    date_range: ['2025-01-01', '2025-01-31']
  });
  return { token: data.token, params };
}
```

#### `IframeOptions`

Options applied to the iframe element and passed to the embed via URL/search params.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `theme` | `'LIGHT'` \| `'DARK'` | Browser's system theme | UI theme of the embedded notebook |
| `locale` | `string` | Browser's locale | Locale code (e.g. `'en'`, `'ja'`) for the embed UI |
| `className` | `string` | - | CSS class name(s) applied to the iframe element |
| `style` | `object` | `{width: '100%', height: '100%', border: 'none'}` | Inline styles for the iframe; overrides the default styles |

#### `TokenOptions`

Controls token lifetime, refresh behavior, and init timeout.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `refreshBuffer` | `number` | `60` | Number of seconds before the token expires when auto-refresh is triggered |
| `retryCount` | `number` | `2` | Number of retries on token fetch failure; `0` = no retry |
| `initTimeout` | `number` | `30000` | Max wait in ms for embed "ready"; `0` = no timeout |
| `onRefreshError` | `(error: CodatumEmbedError) => void` | `undefined` | Callback invoked when token auto-refresh fails (due to `tokenProvider` failure) and does not recover after all retries |

#### `DisplayOptions`

Sent to the embed with the token.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sqlDisplay` | `'SHOW'` \| `'RESULT_ONLY'` \| `'HIDE'` | `'SHOW'` | Whether to show SQL Blocks, results only, or hide |
| `hideParamsForm` | `boolean` | `false` | Hide the parameter form in the embed (e.g. when your app owns the filters) |
| `expandParamsFormByDefault` | `boolean` | `false` | Whether the parameter form is expanded by default |

### Instance methods

| Method | Description |
|--------|-------------|
| `async reload()` | Calls `tokenProvider` again and sends the returned token and params via `SET_TOKEN`. Throws `CodatumEmbedError` on failure. |
| `destroy()` | Removes iframe, clears listeners and timers. No-op if already destroyed. |

### Instance properties

| Property | Type | Description |
|----------|------|-------------|
| `iframe` | `HTMLIFrameElement \| null` | The embed iframe element. |
| `status` | `'INITIALIZING' \| 'READY' \| 'DESTROYED'` | Current instance state. |

### Events

Subscribe with `on(event, handler)` and `off(event, handler)`.

| Event | Description | Payload |
|-------|-------------|---------|
| `paramChanged` | User changed parameters in the embed. | `{ type: 'PARAM_CHANGED', params: EncodedParam[] }` |
| `executeSqlsTriggered` | SQL execution was triggered in the embed. | `{ type: 'EXECUTE_SQLS_TRIGGERED', params: EncodedParam[] }` |

Decode with `ParamMapper.decode(payload.params)`. `EncodedParam`: see [ParamMapper](#parammapper).

## ParamMapper

The embed uses `param_id`s (IDs assigned per notebook parameter). Your app typically works with meaningful keys such as `store_id` or `date_range`. **ParamMapper** maps between your app’s key–value pairs and Codatum’s `param_id` + `param_value` in both directions.

### Basic usage

```ts
import { CodatumEmbed } from '@codatum/embed';

const paramMapper = CodatumEmbed.createParamMapper({
  store_id: '67a1b2c3d4e5f6a7b8c9d0e1',
  date_range: '67a1b2c3d4e5f6a7b8c9d0e2',
  product_category: '67a1b2c3d4e5f6a7b8c9d0e3',
});

const appState = {
  store_id: 'store_001',
  date_range: ['2025-01-01', '2025-01-31'],
  product_category: ['Electronics'],
};

// encode: app key:value → EncodedParam[] (use in tokenProvider return)
paramMapper.encode(appState);
// → [
//   { param_id: '67a1b2c3...', param_value: '"store_001"' },
//   { param_id: '67a1b2c3...', param_value: '["2025-01-01","2025-01-31"]' },
//   { param_id: '67a1b2c3...', param_value: '["Electronics"]' },
// ]

// decode: EncodedParam[] → app key:value (use in paramChanged / executeSqlsTriggered)
paramMapper.decode(payload.params);
// → { store_id: 'store_001', date_range: [...], product_category: ['Electronics'] }
```

### Creating a mapper

**`createParamMapper(mapping, meta?)`**

| Argument | Type | Description |
|----------|------|-------------|
| `mapping` | `Record<string, string>` | Your app’s key → Codatum `param_id` for each parameter. |
| `meta` | `Record<key, ParamMeta>` (optional) | Same keys as `mapping`. Per-key options: `hidden`, `required`, `datatype`. |

**`ParamMeta`** (optional, per key):

| Property | Type | Description |
|----------|------|-------------|
| `datatype` | `ParamDatatype` | Enables validation and improves typing. See [Param datatypes](#param-datatypes) below. |
| `required` | `boolean` | If `true`, `encode` and `decode` throw `MISSING_REQUIRED_PARAM` when the param is missing. |
| `hidden` | `boolean` | If `true`, encoded params include `is_hidden: true` so the embed can hide them from the params form. |

#### Param datatypes

When `meta[key].datatype` is set, `encode` and `decode` validate values. Supported values:

| `ParamDatatype` | JS/TS type | Notes |
|-----------------|------------|--------|
| `'STRING'` | `string` | — |
| `'NUMBER'` | `number` | Rejects `NaN`. |
| `'BOOLEAN'` | `boolean` | — |
| `'DATE'` | `string` | Must be `YYYY-MM-DD`. |
| `'STRING[]'` | `string[]` | Array of strings. |
| `'[DATE, DATE]'` | `[string, string]` | Date range; both elements must be `YYYY-MM-DD`. |

### Instance methods

| Method | Description |
|--------|-------------|
| **`encode(values, options?)`** | App key:value → `EncodedParam[]`. JSON-stringifies values. Use `RESET_TO_DEFAULT` as a value to reset that param to the notebook’s default.
| **`decode(params, options?)`** | `EncodedParam[]` → app key:value. Ignores params not in mapping. |

#### `encode` / `decode` options

Both methods accept an optional second argument:

| Option | Type | Description |
|--------|------|-------------|
| `only` | `(keyof mapping)[]` | Limit to these keys. Useful when the host sends only a subset (e.g. server sends some params; client sends the rest via `encode` with `only`). |
| `noValidate` | `boolean` | When `true`, skips required and datatype validation. |

### Type-first usage

When you define parameter definitions (e.g. with `datatype`) and want typed encode/decode, you can use the helper types.

```ts
import { createParamMapper, RESET_TO_DEFAULT, type DefineDecodedParams, type EncodedParam } from '@codatum/embed';

const paramDefs = {
  store_id: { datatype: 'STRING', required: true },
  date_range: { datatype: '[DATE, DATE]' },
  product_category: { datatype: 'STRING[]' },
} as const;

type ParamValues = DefineDecodedParams<typeof paramDefs>;
// → { store_id: string, date_range?: [string, string], product_category?: string[] }

const paramValues: ParamValues = {
  store_id: 'store_001',
  date_range: RESET_TO_DEFAULT,
  product_category: ['Electronics']
};

const paramMapper = createParamMapper({
  store_id: '67a1b2c3d4e5f6a7b8c9d0e1',
  date_range: '67a1b2c3d4e5f6a7b8c9d0e2',
  product_category: '67a1b2c3d4e5f6a7b8c9d0e3',
}, paramDefs);

// encode only the date_range and product_category params for client-side params
const clientParams = paramMapper.encode(paramValues, { only: ['date_range', 'product_category'] })
// → [
//   { param_id: '67a1b2c3d4e5f6a7b8c9d0e2', param_value: '["2025-01-01","2025-01-31"]' },
//   { param_id: '67a1b2c3d4e5f6a7b8c9d0e3', param_value: '["Electronics"]' },
// ]

const onParamChanged = (ev: { params: EncodedParam[] }) => {
  const values: ParamValues = paramMapper.decode(ev.params);
  console.log('Changed:', values);
};
```

## Errors

All errors are thrown/rejected as `CodatumEmbedError` with a `code` property.

| Code | Thrown by | Description |
|------|----------|-------------|
| `CONTAINER_NOT_FOUND` | `init` | Container element not found |
| `INVALID_OPTIONS` | `init` | Options are invalid |
| `INIT_TIMEOUT` | `init` | Ready not received within `tokenOptions.initTimeout` |
| `TOKEN_PROVIDER_FAILED` | `init` / `reload` | `tokenProvider` threw |
| `MISSING_REQUIRED_PARAM` | `encode` / `decode` | Required param missing |
| `INVALID_PARAM_VALUE` | `encode` / `decode` | Value failed validation |

### Error handling

`init()` and `reload()` throw on failure — handle with try/catch. Auto-refresh errors are delivered via the `tokenOptions.onRefreshError` callback.
```ts
try {
  const embed = await CodatumEmbed.init({
    container: '#dashboard',
    embedUrl: '...',
    tokenProvider: async () => { /* ... */ },
    tokenOptions: {
      onRefreshError: (error) => {
        // Token auto-refresh failed after all retries.
        // e.g. redirect to login, show a banner, etc.
        console.error('Refresh failed:', error);
      },
    },
  });

  // reload() also throws on failure
  await embed.reload();
} catch (error) {
  if (error instanceof CodatumEmbedError) {
      // error.cause holds the original error thrown by tokenProvider (if applicable)
    console.error(error.code, error.message);
  }
}
```

## Usage examples

### Basic (params form in embed)

```ts
const paramMapper = CodatumEmbed.createParamMapper({
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
    const data = await res.json();
    return {
      token: data.token,
      params: paramMapper.encode({
        date_range: '_RESET_TO_DEFAULT_',
        product_category: ['Electronics'],
        store_id: currentUser.defaultStoreId,
      }),
    };
  },
  tokenOptions: {
    refreshBuffer: 300,
    onRefreshError: () => { window.location.href = '/login'; },
  },
});

embed.on('paramChanged', (payload) => {
  const values = paramMapper.decode(payload.params);
  console.log('Changed:', values);
});
```

### Client-side params only (SaaS manages filters, hide params form)

```ts
let currentStoreId = 'store_001';
let currentDateRange: [string, string] = ['2025-01-01', '2025-01-31'];

const paramMapper = CodatumEmbed.createParamMapper(
  {
    store_id: '67a1b2c3d4e5f6a7b8c9d0e1',
    date_range: '67a1b2c3d4e5f6a7b8c9d0e2',
    product_category: '67a1b2c3d4e5f6a7b8c9d0e3',
  },
  { store_id: { hidden: true } },
);

const embed = await CodatumEmbed.init({
  container: '#dashboard',
  embedUrl: '...',
  iframeOptions: { theme: 'LIGHT', locale: 'ja' },
  displayOptions: { hideParamsForm: true },
  tokenProvider: async () => {
    const res = await fetch('/api/codatum/token', { method: 'POST', ... });
    const data = await res.json();
    return {
      token: data.token,
      params: paramMapper.encode(
        { store_id: currentStoreId, date_range: currentDateRange, product_category: ['Electronics'] },
      ),
    };
  },
});

async function onFilterChange(storeId: string, dateRange: [string, string]) {
  currentStoreId = storeId;
  currentDateRange = dateRange;
  await embed.reload(); // tokenProvider is called again with current closure values
}
```

### Server-side parameter change (token re-issue)

```ts
let currentStoreId = 'store_001';
const paramMapper = CodatumEmbed.createParamMapper(
  {
    store_id: '67a1b2c3d4e5f6a7b8c9d0e1',
    date_range: '67a1b2c3d4e5f6a7b8c9d0e2',
    product_category: '67a1b2c3d4e5f6a7b8c9d0e3',
  },
  { store_id: { hidden: true } },
);
let latestValues = paramMapper.decode([]);

const embed = await CodatumEmbed.init({
  container: '#dashboard',
  embedUrl: '...',
  tokenProvider: async () => {
    const res = await fetch('/api/codatum/token', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: currentUser.tenantId, store_id: currentStoreId }),
    });
    const data = await res.json();
    return {
      token: data.token,
      params: paramMapper.encode({
        date_range: '_RESET_TO_DEFAULT_',
        product_category: ['Electronics'],
        store_id: currentStoreId,
      }),
    };
  },
});

embed.on('paramChanged', (payload) => { latestValues = paramMapper.decode(payload.params); });

async function onStoreSwitch(storeId: string) {
  currentStoreId = storeId;
  await embed.reload(); // tokenProvider returns new token + params for the new store
}
```

### Multiple notebooks

```ts
const [salesDashboard, supportDashboard] = await Promise.all([
  CodatumEmbed.init({
    container: '#sales',
    embedUrl: 'https://app.codatum.com/.../notebook/aaa',
    tokenProvider: () => fetchSession('aaa'), // returns { token, params? }
  }),
  CodatumEmbed.init({
    container: '#support',
    embedUrl: 'https://app.codatum.com/.../notebook/bbb',
    tokenProvider: () => fetchSession('bbb'),
  }),
]);
```

## CDN

```html
<script src="https://unpkg.com/@codatum/embed/dist/index.global.min.js"></script>
<script>
  CodatumEmbed.init({ container: '#dashboard', embedUrl: '...', tokenProvider: async () => ({ token: '...' }) });
</script>
```

## Security and deployment

- **CSP**: If your app sets Content-Security-Policy, allow `frame-src https://app.codatum.com`.
- **iframe**: The SDK sets `allow="fullscreen; clipboard-write"` on the iframe. Styling defaults to 100% width/height; override with `iframeOptions.style`.

## Supported environments

- Browsers: ES2017+ (Chrome 63+, Firefox 57+, Safari 12+, iOS Safari 12+)
- Module formats: ESM, CJS, IIFE (see CDN)

## Contributing

Setup, build, test, and package layout: [CONTRIBUTING.md](CONTRIBUTING.md).
