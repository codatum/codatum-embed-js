<script setup lang="ts">
import { EmbedVue } from "@codatum/embed-vue";

const tokenProvider = async () => {
  return { token: "mock-token", params: [] };
};
</script>

<template>
  <div class="border bg-white">
    <EmbedVue
      embedUrl="https://example.com/embed"
      :tokenProvider="tokenProvider"
      :iframeOptions="{
        theme: 'LIGHT',
        locale: 'en',
        className: 'vue-example-iframe',
        style: { height: '600px' },
      }"
      :devOptions="{ debug: true, mock: true, disableValidateUrl: true }"
    />
  </div>
</template>
