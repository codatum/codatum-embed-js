# @codatum/embed-vue

Vue 3 integration for Codatum Signed Embed. Provides a single component that wraps the core SDK. All of [@codatum/embed](/README.md) is re-exported so you can use this package as a single entry point (one version, no split).

For options, types, events, and programmatic API details, see **[@codatum/embed](/README.md)**.

## Installation

```bash
pnpm add @codatum/embed-vue
```

## Usage

```vue
<script setup lang="ts">
import { CodatumEmbedVue } from "@codatum/embed-vue";

const embedUrl = "https://app.codatum.com/embed/...";
async function tokenProvider() {
  const res = await fetch("/api/embed-token", { method: "POST" });
  const data = await res.json();
  return { token: data.token };
}
</script>

<template>
  <CodatumEmbedVue
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

Calling `reload` from the parent: use a ref and `embedRef.value?.instance?.reload()`. See [@codatum/embed](/README.md) for the instance API.

## API

Option types and behavior (e.g. `iframeOptions`, `tokenOptions`, `displayOptions`) are the same as in [@codatum/embed](/README.md). The component uses its root element as the iframe container (no `container` prop).

### Props

| Prop | Required | Type | Description |
|------|----------|------|-------------|
| `embedUrl` | Yes | `string` | Signed embed URL from Codatum |
| `tokenProvider` | Yes | `() => Promise<TokenProviderResult>` | Called on init, reload, and token refresh; see [@codatum/embed](/README.md) |
| `iframeOptions` | No | `IframeOptions` | theme, locale, className, style |
| `tokenOptions` | No | `TokenOptions` | refreshBuffer, retryCount, initTimeout, onRefreshError |
| `displayOptions` | No | `DisplayOptions` | sqlDisplay, hideParamsForm, expandParamsFormByDefault |

### Events

| Event | Payload | When |
|-------|---------|------|
| `ready` | — | Embed is ready and token/params have been applied |
| `paramChanged` | `{ params: EncodedParam[] }` | User changed params in the embed |
| `executeSqlsTriggered` | `{ params: EncodedParam[] }` | Execute SQL was triggered in the embed |
| `error` | `Error` | Init or token provider failed |

### Expose (ref)

| Property | Type | Description |
|----------|------|-------------|
| `instance` | `CodatumEmbed \| null` | Core embed instance; use for `reload()`, `on()`, `off()`, `destroy()` |
| `status` | `'INITIALIZING' \| 'READY' \| 'DESTROYED'` | Current embed state |
| `error` | `Error \| null` | Last error from init or tokenProvider |

Need a custom container or full control? Use `CodatumEmbed.init()` from this package (or [@codatum/embed](/README.md)) in `onMounted` and `instance.destroy()` in `onUnmounted`.
