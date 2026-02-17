<script setup lang="ts">
import {
  CodatumEmbedVue,
  createParamMapper,
  RESET_TO_DEFAULT,
  type EncodedParam,
  type ParamMapDef,
  type ParamMapper,
} from "@codatum/embed-vue";
import { onMounted, ref } from "vue";

const SERVER_URL = "http://localhost:3100";
const SCENARIO_ID = "scenario1";

const embedUrl = ref<string | null>(null);
const statusMessage = ref("Loading config…");
const statusError = ref(false);

type ClientParamMapDefs = {
  date_range: ParamMapDef;
  product_category: ParamMapDef;
};
type ClientParamValues = {
  date_range?: [string, string] | typeof RESET_TO_DEFAULT;
  product_category?: string;
};
const clientParamMapper = ref<ParamMapper<ClientParamMapDefs> | null>(null);
const clientParamValues = ref<ClientParamValues>({
  date_range: RESET_TO_DEFAULT,
});

type ServerParamMapDefs = {
  store_id: ParamMapDef;
};
type ServerParamValues = {
  store_id?: string;
};
const serverParamMapper = ref<ParamMapper<ServerParamMapDefs> | null>(null);
const serverParamValues = ref<ServerParamValues>({});

onMounted(async () => {
  try {
    const configRes = await fetch(`${SERVER_URL}/${SCENARIO_ID}/config`);
    if (!configRes.ok) throw new Error(`config failed: ${configRes.status}`);
    const config = await configRes.json();
    embedUrl.value = config.embedUrl;
    const _params = config.params as ClientParamMapDefs & ServerParamMapDefs;
    clientParamMapper.value = createParamMapper({
      date_range: _params.date_range,
      product_category: _params.product_category,
    });
    serverParamMapper.value = createParamMapper({
      store_id: _params.store_id,
    });
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
  const res = await fetch(`${SERVER_URL}/${SCENARIO_ID}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tokenUserId: "demo-user",
      params: {
        store_id: serverParamValues.value.store_id,
      },
    }),
  });
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Token issuance failed");
  }
  const data = (await res.json()) as { token: string };
  return {
    token: data.token,
    params: clientParamMapper.value?.encode(clientParamValues.value) ?? [],
  };
};

const onParamChanged = (ev: { params: EncodedParam[] }) => {
  if (!clientParamMapper.value || !serverParamMapper.value) return;
  clientParamValues.value = clientParamMapper.value.decode(
    ev.params
  ) as ClientParamValues;
  serverParamValues.value = serverParamMapper.value.decode(
    ev.params
  ) as ServerParamValues;
};

const onEmbedError = (err: Error) => {
  statusMessage.value = err.message;
  statusError.value = true;
};

const embedRef = ref<InstanceType<typeof CodatumEmbedVue> | null>(null);
const reloadEmbed = () => {
  embedRef.value?.instance?.reload();
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
