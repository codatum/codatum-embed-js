# @codatum/embed-vue

Vue 3 integration for Codatum Signed Embed. Provides a single component that wraps the core SDK. All of [@codatum/embed](https://github.com/codatum/codatum-embed-js/tree/main/packages/embed#readme) is re-exported so you can use this package as a single entry point (one version, no split).

For options, types, events, and programmatic API details, see **[@codatum/embed](https://github.com/codatum/codatum-embed-js/tree/main/packages/embed#readme)**.

## Installation

```bash
pnpm add @codatum/embed-vue
```

Requires **Vue 3** (peer dependency).

## Usage
```vue
<script setup lang="ts">
import { EmbedVue } from "@codatum/embed-vue";

const embedUrl = "https://app.codatum.com/protected/workspace/xxx/notebook/yyy";
const tokenProvider = async () => {
  const res = await fetch("/api/embed-token", { method: "POST" });
  const data = await res.json();
  return { token: data.token };
}
</script>

<template>
  <EmbedVue
    :embedUrl="embedUrl"
    :tokenProvider="tokenProvider"
    :iframeOptions="{ theme: 'LIGHT', locale: 'ja' }"
    @ready="console.log('Embed ready')"
    @paramChanged="(e) => console.log('Params', e.params)"
    @executeSqlsTriggered="(e) => console.log('Execute', e.params)"
    @error="(e) => console.error(e)"
  />
</template>
```

### Calling `reload` from the parent

Use a template ref and call the exposed `reload()` method. It returns `true` on success and `false` on failure (errors are emitted via `@error`; it does not throw).
```vue
<script setup lang="ts">
import { ref } from "vue";
import { EmbedVue } from "@codatum/embed-vue";

const embedRef = ref<InstanceType<typeof EmbedVue> | null>(null);

async function onFilterChange() {
  const ok = await embedRef.value?.reload();
  if (!ok) console.warn("reload failed — see @error");
}
</script>

<template>
  <EmbedVue ref="embedRef" :embedUrl="..." :tokenProvider="..." @error="handleError" />
</template>
```

### Changing props at runtime

Props are read once at mount. To apply new values (e.g. a different `embedUrl` or `iframeOptions`), use `:key` to force a remount:

```vue
<EmbedVue :key="embedUrl" :embedUrl="embedUrl" :tokenProvider="tokenProvider" />
```

## API

Option types and behavior (e.g. `iframeOptions`, `tokenOptions`, `displayOptions`) are the same as in [@codatum/embed](https://github.com/codatum/codatum-embed-js/tree/main/packages/embed#readme). The component uses its root element as the iframe container (no `container` prop).

### Props

| Prop | Required | Type |
|------|----------|------|
| `embedUrl` | Yes | `string` |
| `tokenProvider` | Yes | `(context: TokenProviderContext) => Promise<TokenProviderResult>` |
| `iframeOptions` | No | `IframeOptions` |
| `tokenOptions` | No | `TokenOptions` |
| `displayOptions` | No | `DisplayOptions` |

### Events

| Event | Payload | When |
|-------|---------|------|
| `ready` | — | Embed is ready and token/params have been applied |
| `paramChanged` | `{ type: 'PARAM_CHANGED', params: EncodedParam[] }` | See core SDK |
| `executeSqlsTriggered` | `{ type: 'EXECUTE_SQLS_TRIGGERED', params: EncodedParam[] }` | See core SDK |
| `error` | `EmbedError` | Init, reload, or token auto-refresh failed |

### Expose (ref)

| Property | Type | Description |
|----------|------|-------------|
| `reload()` | `() => Promise<boolean>` | Re-fetches token and params; returns `false` on failure (error emitted via `@error`) |
| `status` | `'CREATED' \| 'INITIALIZING' \| 'READY' \| 'DESTROYED'` | Current embed state |

Need a custom container or full control? Use `createEmbed()` from this package (or [@codatum/embed](https://github.com/codatum/codatum-embed-js/tree/main/packages/embed#readme)) in `onMounted` and `instance.destroy()` in `onUnmounted`.

## See also

- **Versioning and changelog**: [Versioning](https://github.com/codatum/codatum-embed-js#versioning)
- **Security and deployment**: [Security and deployment](https://github.com/codatum/codatum-embed-js#security-and-deployment)
- **Supported environments**: [Supported environments](https://github.com/codatum/codatum-embed-js#supported-environments)
