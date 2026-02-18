<script setup lang="ts">
import {
  CodatumEmbedVue,
  createParamMapper,
  RESET_TO_DEFAULT,
  type CodatumEmbedError,
  type EncodedParam,
  type DefineDecodedParams,
  type DefineParamMapper,
} from "@codatum/embed-vue";
import { onMounted, ref } from "vue";

const API_URL = "http://localhost:3100/scenario1";

const embedUrl = ref<string | null>(null);
const statusMessage = ref("Loading config…");
const statusError = ref(false);

const paramDefs = {
  store_id: { datatype: "STRING" },
  date_range: { datatype: "[DATE, DATE]" },
  product_category: { datatype: "STRING" },
} as const;

type ParamValues = DefineDecodedParams<typeof paramDefs>;
type ParamMapper = DefineParamMapper<typeof paramDefs>;

const paramMapper = ref<ParamMapper | null>(null);
const paramValues = ref<ParamValues>({
  store_id: undefined,
  date_range: RESET_TO_DEFAULT,
  product_category: undefined,
});

onMounted(async () => {
  try {
    const configRes = await fetch(`${API_URL}/config`);
    if (!configRes.ok) throw new Error(`config failed: ${configRes.status}`);
    const config = await configRes.json();
    embedUrl.value = config.embedUrl;
    paramMapper.value = createParamMapper(
      config.paramMapping,
      paramDefs
    ) as ParamMapper;
    statusMessage.value = "Initializing…";
  } catch (err) {
    statusMessage.value =
      "Failed to fetch config. Ensure the server is running at localhost:3100.";
    statusError.value = true;
    console.error(err);
  }
});

const onReady = () => {
  statusMessage.value = "Ready";
  statusError.value = false;
};

const tokenProvider = async () => {
  const res = await fetch(`${API_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tokenUserId: "demo-user",
      params: {
        store_id: paramValues.value.store_id,
      },
    }),
  });
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Token issuance failed");
  }
  const data = (await res.json()) as { token: string };
  const clientParams =
    paramMapper.value?.encode(paramValues.value, {
      only: ["date_range", "product_category"],
    }) ?? [];
  console.log("tokenProvider result:", {
    token: data.token,
    params: clientParams,
  });
  return {
    token: data.token,
    params: clientParams,
  };
};

const onParamChanged = (ev: { params: EncodedParam[] }) => {
  if (!paramMapper.value) return;
  paramValues.value = paramMapper.value.decode(
    ev.params
  ) as typeof paramValues.value;
};

const onEmbedError = (err: CodatumEmbedError) => {
  statusMessage.value = err.message;
  statusError.value = true;
};

const embedRef = ref<InstanceType<typeof CodatumEmbedVue> | null>(null);
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
  <div
    class="alert py-2 mb-3"
    :class="statusError ? 'alert-danger' : 'alert-success'"
  >
    {{ statusMessage }}
  </div>
  <div v-if="embedUrl" class="border bg-white">
    <CodatumEmbedVue
      ref="embedRef"
      :embedUrl="embedUrl"
      :tokenProvider="tokenProvider"
      :iframeOptions="{
        theme: 'LIGHT',
        locale: 'en',
        className: 'vue-example-iframe',
        style: { height: '600px' },
      }"
      :tokenOptions="{}"
      :displayOptions="{ expandParamsFormByDefault: true }"
      @ready="onReady"
      @paramChanged="onParamChanged"
      @executeSqlsTriggered="onParamChanged"
      @error="onEmbedError"
    />
  </div>
</template>
