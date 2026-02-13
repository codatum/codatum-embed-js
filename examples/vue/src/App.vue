<script setup lang="ts">
import { CodatumEmbed } from "@codatum/embed-vue";
import { onMounted, ref } from "vue";

const SERVER_URL = "http://localhost:3100";

const embedUrl = ref<string | null>(null);
const statusMessage = ref("Loading config…");
const statusError = ref(false);

async function tokenProvider(): Promise<string> {
  const res = await fetch(`${SERVER_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokenUserId: "demo-user" }),
  });
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Token issuance failed");
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

onMounted(async () => {
  try {
    const configRes = await fetch(`${SERVER_URL}/config`);
    if (!configRes.ok) throw new Error(`config failed: ${configRes.status}`);
    const config = (await configRes.json()) as { embedUrl: string };
    embedUrl.value = config.embedUrl;
    statusMessage.value = "Initializing…";
  } catch (err) {
    statusMessage.value =
      "Failed to fetch config. Ensure the server is running at localhost:3100.";
    statusError.value = true;
    console.error(err);
  }
});

function onReady() {
  statusMessage.value = "Ready";
  statusError.value = false;
}

function onEmbedError(err: Error) {
  statusMessage.value = err.message;
  statusError.value = true;
}
</script>

<template>
  <div class="container">
    <h1 class="h5 mb-3">Codatum Embed — Vue Example</h1>
    <div
      class="alert py-2 mb-3"
      :class="statusError ? 'alert-danger' : 'alert-success'"
    >
      {{ statusMessage }}
    </div>
    <div v-if="embedUrl" class="border bg-white" style="height: 600px">
      <CodatumEmbed
        :embed-url="embedUrl"
        :token-provider="tokenProvider"
        :iframe-options="{ theme: 'LIGHT', locale: 'en' }"
        @ready="onReady"
        @param-changed="(e) => console.log('[paramChanged]', e)"
        @execute-sqls-triggered="(e) => console.log('[executeSqlsTriggered]', e)"
        @error="onEmbedError"
      />
    </div>
  </div>
</template>
