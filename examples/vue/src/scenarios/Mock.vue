<script setup lang="ts">
import { EmbedVue } from "@codatum/embed-vue";
import { ref } from "vue";

const tokenProvider = async () => {
  return { token: "mock-token", params: [] };
};

const embedRef = ref<InstanceType<typeof EmbedVue> | null>(null);
const reloadEmbed = async () => {
  await embedRef.value?.reload();
};
</script>

<template>
  <div class="mb-3 text-end">
    <button
      type="button"
      @click="reloadEmbed"
      class="btn btn-outline-secondary"
    >
      Reload
    </button>
  </div>
  <div class="border bg-white position-relative embed-container">
    <EmbedVue
      ref="embedRef"
      embedUrl="https://example.com/embed"
      :tokenProvider="tokenProvider"
      :iframeOptions="{
        theme: 'LIGHT',
        locale: 'en',
        className: 'vue-example-iframe',
      }"
      :devOptions="{
        debug: true,
        mock: { loadingDelay: 2 },
        disableValidateUrl: true,
      }"
    >
      <template #loading="{ status }">
        <div class="mock-loading">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="mock-loading-text mt-2 mb-0">
            {{
              status === "INITIALIZING"
                ? "Initializing…"
                : status === "RELOADING"
                ? "Reloading…"
                : "Refreshing…"
            }}
          </p>
        </div>
      </template>
    </EmbedVue>
  </div>
</template>

<style scoped>
.embed-container {
  height: 600px;
}

.mock-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
