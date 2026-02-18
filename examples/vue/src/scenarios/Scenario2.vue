<script setup lang="ts">
import {
  CodatumEmbedVue,
  createParamMapper,
  RESET_TO_DEFAULT,
  type EncodedParam,
  type DefineDecodedParams,
  type DefineParamMapper,
} from "@codatum/embed-vue";
import { onMounted, ref, computed } from "vue";

const API_URL = "http://localhost:3100/scenario2";

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
      only: ["store_id", "date_range", "product_category"],
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
  paramValues.value = paramMapper.value.decode(ev.params) as ParamValues;
};

const dateRangeStart = computed({
  get: () => {
    if (paramValues.value.date_range === RESET_TO_DEFAULT) return "";
    return paramValues.value.date_range?.[0] ?? "";
  },
  set: (v: string) => {
    const prev = paramValues.value.date_range ?? ["", ""];
    paramValues.value = {
      ...paramValues.value,
      date_range: [v, prev[1] ?? ""],
    };
  },
});
const dateRangeEnd = computed({
  get: () => {
    if (paramValues.value.date_range === RESET_TO_DEFAULT) return "";
    return paramValues.value.date_range?.[1] ?? "";
  },
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
const reloadEmbed = async () => {
  try {
    await embedRef.value?.instance?.reload();
  } catch (err: unknown) {
    onEmbedError(err as Error);
  }
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
      :tokenOptions="{
        onRefreshError: onEmbedError,
      }"
      :displayOptions="{ hideParamsForm: true }"
      @ready="onReady"
      @paramChanged="onParamChanged"
      @executeSqlsTriggered="onParamChanged"
      @error="onEmbedError"
    />
  </div>
</template>
