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
  type TokenProviderContext,
} from "@codatum/embed-vue";
import { computed, onMounted, ref } from "vue";

const API_URL = "http://localhost:3100/scenario3";
type Config = {
  embedUrl: string;
  paramMapping: { [key: string]: string };
  userId: string;
  storeIds: string[];
};

const embedUrl = ref<string | null>(null);
const userId = ref<string | null>(null);
const storeIds = ref<string[]>([]);
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
  product_category: ["Electronics"],
});

onMounted(async () => {
  try {
    const configRes = await fetch(`${API_URL}/config`);
    if (!configRes.ok) throw new Error(`config failed: ${configRes.status}`);
    const config: Config = await configRes.json();
    embedUrl.value = config.embedUrl;
    userId.value = config.userId;
    storeIds.value = config.storeIds;
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

const tokenProvider = async (ctx: TokenProviderContext) => {
  const res = await fetch(`${API_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tokenUserId: userId.value,
      params: {
        store_id: paramValues.value.store_id,
      },
    }),
  });
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    if (res.status === 400) {
      ctx.markNonRetryable();
    }
    throw new Error(data.message ?? "Token issuance failed");
  }
  const data = (await res.json()) as { token: string };
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
  <div class="border rounded p-3 bg-light mb-3">
    <h2 class="h6 mb-3">Parameters</h2>
    <div class="mb-2">
      <label for="store_id" class="form-label small mb-1">Store Id</label>
      <select
        id="store_id"
        v-model="paramValues.store_id"
        class="form-control form-control-sm"
      >
        <option v-for="storeId in storeIds" :key="storeId" :value="storeId">
          {{ storeId }}
        </option>
        <option value="store3">store3(invalid)</option>
      </select>
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
    {{ statusDisplay }}
  </div>
  <div
    v-if="embedUrl"
    class="border bg-white position-relative embed-container"
  >
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
      :showLoadingOn="['INITIALIZING', 'RELOADING', 'REFRESHING']"
      @statusChanged="onStatusChanged"
      @paramChanged="onParamChanged"
      @executeSqlsTriggered="onParamChanged"
      @error="onEmbedError"
    >
      <template #loading="{ status }">
        <div class="scenario3-loading">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="scenario3-loading-text mt-2 mb-0">
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

.scenario3-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}
.scenario3-loading-text {
  font-size: 0.9rem;
  color: var(--bs-secondary, #6c757d);
}
</style>
