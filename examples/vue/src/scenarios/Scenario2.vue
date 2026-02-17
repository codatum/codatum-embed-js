<script setup lang="ts">
import {
  CodatumEmbedVue,
  createParamMapper,
  type EncodedParam,
  type ParamMapDef,
  type ParamMapper,
} from "@codatum/embed-vue";
import { onMounted, ref, computed } from "vue";

const SERVER_URL = "http://localhost:3100";
const SCENARIO_ID = "scenario2";

const embedUrl = ref<string | null>(null);
const statusMessage = ref("Loading config…");
const statusError = ref(false);

type ParamMapDefs = {
  store_id: ParamMapDef;
  date_range: ParamMapDef;
  product_category: ParamMapDef;
};
type ParamValues = {
  store_id?: string;
  date_range?: [string, string];
  product_category?: string;
};
const paramMapper = ref<ParamMapper<ParamMapDefs> | null>(null);
const paramValues = ref<ParamValues>({});

onMounted(async () => {
  try {
    const configRes = await fetch(`${SERVER_URL}/${SCENARIO_ID}/config`);
    if (!configRes.ok) throw new Error(`config failed: ${configRes.status}`);
    const config = await configRes.json();
    embedUrl.value = config.embedUrl;
    const _params = config.params as ParamMapDefs;
    paramMapper.value = createParamMapper({
      store_id: _params.store_id,
      date_range: _params.date_range,
      product_category: _params.product_category,
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
        store_id: paramValues.value.store_id,
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
    params: paramMapper.value?.encode(paramValues.value) ?? [],
  };
};

const onParamChanged = (ev: { params: EncodedParam[] }) => {
  if (!paramMapper.value) return;
  paramValues.value = paramMapper.value.decode(ev.params) as ParamValues;
};

const dateRangeStart = computed({
  get: () => paramValues.value.date_range?.[0] ?? "",
  set: (v: string) => {
    const prev = paramValues.value.date_range ?? ["", ""];
    paramValues.value = {
      ...paramValues.value,
      date_range: [v, prev[1] ?? ""],
    };
  },
});
const dateRangeEnd = computed({
  get: () => paramValues.value.date_range?.[1] ?? "",
  set: (v: string) => {
    const prev = paramValues.value.date_range ?? ["", ""];
    paramValues.value = {
      ...paramValues.value,
      date_range: [prev[0] ?? "", v],
    };
  },
});

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
  <div class="border rounded p-3 bg-light mb-3">
    <h2 class="h6 mb-3">Parameters</h2>
    <div class="mb-2">
      <label for="store_id" class="form-label small mb-1">Store Id</label>
      <input
        id="store_id"
        v-model="paramValues.store_id"
        type="text"
        class="form-control form-control-sm"
      />
    </div>
    <div class="mb-2">
      <label for="date_range" class="form-label small mb-1">Date Range</label>
      <div class="row g-2">
        <div class="col">
          <input
            id="date_range-start"
            v-model="dateRangeStart"
            type="text"
            class="form-control form-control-sm"
            placeholder="Start"
          />
        </div>
        <div class="col">
          <input
            id="date_range-end"
            v-model="dateRangeEnd"
            type="text"
            class="form-control form-control-sm"
            placeholder="End"
          />
        </div>
      </div>
    </div>
    <div class="mb-3">
      <label for="product_category" class="form-label small mb-1">
        Product Category
      </label>
      <input
        id="product_category"
        v-model="paramValues.product_category"
        type="text"
        class="form-control form-control-sm"
      />
    </div>
    <div class="text-end">
      <button
        type="button"
        @click="reloadEmbed"
        class="btn btn-outline-secondary"
      >
        Reload
      </button>
    </div>
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
      :displayOptions="{ hideParamsForm: true }"
      @ready="onReady"
      @paramChanged="onParamChanged"
      @executeSqlsTriggered="onParamChanged"
      @error="onEmbedError"
    />
  </div>
</template>
