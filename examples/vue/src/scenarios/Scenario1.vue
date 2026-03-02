<script setup lang="ts">
import {
  EmbedVue,
  createParamMapper,
  RESET_TO_DEFAULT,
  type EmbedError,
  type EmbedStatus,
  type EncodedParam,
  type DefineDecodedParams,
  type DefineParamMapper,
} from "@codatum/embed-vue";
import { computed, onMounted, ref } from "vue";

const API_URL = "http://localhost:3100/scenario1";
type Config = {
  embedUrl: string;
  paramMapping: { [key: string]: string };
  userId: string;
};

const embedUrl = ref<string | null>(null);
const userId = ref<string | null>(null);
const embedStatus = ref<EmbedStatus | null>(null);
const errorMessage = ref<string | null>(null);
const statusError = ref(false);

const paramDefs = {
  store_id: { datatype: "STRING" },
  date_range: { datatype: "[DATE, DATE]" },
  product_category: { datatype: "STRING[]" },
} as const;

type ParamValues = DefineDecodedParams<typeof paramDefs>;
type ParamMapper = DefineParamMapper<typeof paramDefs>;

const paramMapper = ref<ParamMapper | null>(null);
const paramValues = ref<ParamValues>({
  store_id: undefined,
  date_range: RESET_TO_DEFAULT,
  product_category: [],
});

onMounted(async () => {
  try {
    const configRes = await fetch(`${API_URL}/config`);
    if (!configRes.ok) throw new Error(`config failed: ${configRes.status}`);
    const config: Config = await configRes.json();
    embedUrl.value = config.embedUrl;
    userId.value = config.userId;
    paramMapper.value = createParamMapper(
      config.paramMapping,
      paramDefs
    ) as ParamMapper;
  } catch (err) {
    errorMessage.value =
      "Failed to fetch config. Ensure the server is running at localhost:3100.";
    statusError.value = true;
    console.error(err);
  }
});

const onStatusChanged = (payload: { status: EmbedStatus }) => {
  embedStatus.value = payload.status;
  if (payload.status === "READY") {
    statusError.value = false;
    errorMessage.value = null;
  }
};

const tokenProvider = async () => {
  const res = await fetch(`${API_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tokenUserId: userId.value,
      params: {
        // send server-side params to keep current values
        store_id: paramValues.value.store_id,
      },
    }),
  });
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Token issuance failed");
  }
  const data = (await res.json()) as { token: string };
  // send client-side params to keep current values
  const clientParams =
    paramMapper.value?.encode(paramValues.value, {
      only: ["date_range", "product_category"],
    }) ?? [];
  return {
    token: data.token,
    params: clientParams,
  };
};

const onParamChanged = (ev: { params: EncodedParam[] }) => {
  if (!paramMapper.value) return;
  paramValues.value = paramMapper.value.decode(ev.params);
};

const onEmbedError = (err: EmbedError) => {
  errorMessage.value = err.message;
  statusError.value = true;
};

const embedRef = ref<InstanceType<typeof EmbedVue> | null>(null);
const reloadEmbed = async () => {
  await embedRef.value?.reload();
};

const statusDisplay = computed(() =>
  statusError.value && errorMessage.value
    ? errorMessage.value
    : embedStatus.value ?? (embedUrl.value ? "—" : "Loading config…")
);
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
  <div
    class="alert py-2 mb-3"
    :class="statusError ? 'alert-danger' : 'alert-success'"
  >
    {{ statusDisplay }}
  </div>
  <div v-if="embedUrl" class="border bg-white embed-container">
    <EmbedVue
      ref="embedRef"
      :embedUrl="embedUrl"
      :tokenProvider="tokenProvider"
      :iframeOptions="{
        theme: 'LIGHT',
        locale: 'en',
        className: 'vue-example-iframe',
      }"
      :displayOptions="{ expandParamsFormByDefault: true }"
      :devOptions="{ debug: true, disableValidateUrl: true }"
      @statusChanged="onStatusChanged"
      @paramChanged="onParamChanged"
      @executeSqlsTriggered="onParamChanged"
      @error="onEmbedError"
    />
  </div>
</template>

<style scoped>
.embed-container {
  height: 600px;
}
</style>
