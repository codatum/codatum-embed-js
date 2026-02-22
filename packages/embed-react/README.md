# @codatum/embed-react

React integration for Codatum Signed Embed. Provides a single component that wraps the core SDK. All of [@codatum/embed](https://github.com/codatum/codatum-embed-js/tree/main/packages/embed#readme) is re-exported so you can use this package as a single entry point (one version, no split).

For options, types, events, and programmatic API details, see **[@codatum/embed](https://github.com/codatum/codatum-embed-js/tree/main/packages/embed#readme)**.

## Installation

```bash
pnpm add @codatum/embed-react
# or
npm install @codatum/embed-react
```

Requires **React 18+** (peer dependency).

## Usage

```tsx
import { EmbedReact } from "@codatum/embed-react";

const embedUrl = "https://app.codatum.com/protected/workspace/xxx/notebook/yyy";
const tokenProvider = async () => {
  const res = await fetch("/api/embed-token", { method: "POST" });
  const data = await res.json();
  return { token: data.token };
};

function App() {
  return (
    <EmbedReact
      embedUrl={embedUrl}
      tokenProvider={tokenProvider}
      iframeOptions={{ theme: "LIGHT", locale: "ja" }}
      onReady={() => console.log("Embed ready")}
      onParamChanged={(e) => console.log("Params", e.params)}
      onExecuteSqlsTriggered={(e) => console.log("Execute", e.params)}
      onError={(e) => console.error(e)}
    />
  );
}
```

### Calling `reload` from the parent

Use a ref and call the exposed `reload()` method. It returns `true` on success and `false` on failure (errors are reported via `onError`; it does not throw).

```tsx
import { useRef } from "react";
import { EmbedReact, type EmbedReactRef } from "@codatum/embed-react";

function App() {
  const embedRef = useRef<EmbedReactRef>(null);

  async function onFilterChange() {
    const ok = await embedRef.current?.reload();
    if (!ok) console.warn("reload failed — see onError");
  }

  return (
    <>
      <button type="button" onClick={onFilterChange}>
        Reload
      </button>
      <EmbedReact
        ref={embedRef}
        embedUrl="..."
        tokenProvider={...}
        onError={handleError}
      />
    </>
  );
}
```

### Changing props at runtime

Props are read once at mount. To apply new values (e.g. a different `embedUrl` or `iframeOptions`), use `key` to force a remount:

```tsx
<EmbedReact key={embedUrl} embedUrl={embedUrl} tokenProvider={tokenProvider} />
```

## API

Option types and behavior (e.g. `iframeOptions`, `tokenOptions`, `displayOptions`, `devOptions`) are the same as in [@codatum/embed](https://github.com/codatum/codatum-embed-js/tree/main/packages/embed#readme). The component uses its root element as the iframe container (no `container` prop).

### Props

| Prop | Required | Type |
|------|----------|------|
| `embedUrl` | Yes | `string` |
| `tokenProvider` | Yes | `(context: TokenProviderContext) => Promise<TokenProviderResult>` |
| `iframeOptions` | No | `IframeOptions` |
| `tokenOptions` | No | `TokenOptions` |
| `displayOptions` | No | `DisplayOptions` |
| `devOptions` | No | `DevOptions` |

### Callbacks

| Callback | Payload | When |
|----------|---------|------|
| `onReady` | — | Embed is ready and token/params have been applied |
| `onParamChanged` | `(payload: { type: 'PARAM_CHANGED', params: EncodedParam[] }) => void` | See core SDK |
| `onExecuteSqlsTriggered` | `(payload: { type: 'EXECUTE_SQLS_TRIGGERED', params: EncodedParam[] }) => void` | See core SDK |
| `onError` | `(err: EmbedError) => void` | Init, reload, or token auto-refresh failed |

### Ref (`EmbedReactRef`)

| Property | Type | Description |
|----------|------|-------------|
| `reload()` | `() => Promise<boolean>` | Re-fetches token and params; returns `false` on failure (error reported via `onError`) |
| `status` | `'CREATED' \| 'INITIALIZING' \| 'READY' \| 'DESTROYED'` | Current embed state |

Need a custom container or full control? Use `createEmbed()` from this package (or [@codatum/embed](https://github.com/codatum/codatum-embed-js/tree/main/packages/embed#readme)) inside a `useEffect` and call `instance.destroy()` in the cleanup.

## See also

- **Versioning and changelog**: [Versioning](https://github.com/codatum/codatum-embed-js#versioning)
- **Security and deployment**: [Security and deployment](https://github.com/codatum/codatum-embed-js#security-and-deployment)
- **Supported environments**: [Supported environments](https://github.com/codatum/codatum-embed-js#supported-environments)
