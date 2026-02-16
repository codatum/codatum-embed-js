# @codatum/embed-vue

Vue 3 integration for Codatum Signed Embed. Wraps [@codatum/embed](https://github.com/codatum/codatum-embed-js/tree/main/packages/embed) and provides a single component.

## Installation

```bash
pnpm add @codatum/embed-vue
```

## Usage

```vue
<script setup lang="ts">
import { CodatumEmbed } from "@codatum/embed-vue";

const embedUrl = "https://app.codatum.com/embed/...";
async function sessionProvider() {
  const res = await fetch("/api/embed-token", { method: "POST" });
  const data = await res.json();
  return { token: data.token };
}
</script>

<template>
  <CodatumEmbed
    :embed-url="embedUrl"
    :session-provider="sessionProvider"
    :iframe-options="{ theme: 'LIGHT', locale: 'ja' }"
    @ready="console.log('Embed ready')"
    @param-changed="(e) => console.log('Params', e.params)"
    @execute-sqls-triggered="(e) => console.log('Execute', e.params)"
    @error="(e) => console.error(e)"
  />
</template>
```

Calling `reload` from the parent:

```vue
<CodatumEmbed ref="embedRef" ... />

<script setup>
const embedRef = ref(null);
// embedRef.value?.instance?.reload() — calls sessionProvider again
</script>
```

## API

- **CodatumEmbed**  
  - Props: `embedUrl`, `sessionProvider`, `iframeOptions?`, `tokenOptions?`, `displayOptions?`  
  - Events: `ready`, `paramChanged`, `executeSqlsTriggered`, `error`  
  - Expose: `instance`, `status`, `error`, `isReady`

Types such as `CodatumEmbedInstance`, `DisplayOptions`, `IframeOptions`, `SessionProviderResult`, and `TokenOptions` are re-exported from `@codatum/embed`.

Need a custom container or more control? Use [@codatum/embed](https://github.com/codatum/codatum-embed-js/tree/main/packages/embed) directly (e.g. call `init` in `onMounted` and `destroy` in `onUnmounted`).
