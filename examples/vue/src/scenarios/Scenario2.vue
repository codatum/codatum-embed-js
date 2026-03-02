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

const API_URL = "http://localhost:3100/scenario2";
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
  product_category: [],
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

const cachedToken = ref<string | null>(null);

const tokenProvider = async (ctx: TokenProviderContext) => {
  // When server-side params are unchanged, the token can be reused.
  // In production: validate expiry and do not reuse across different users.
  let token = cachedToken.value;
  if (!token) {
    const res = await fetch(`${API_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokenUserId: userId.value,
      }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { message?: string };
      throw new Error(data.message ?? "Token issuance failed");
    }
    const data = (await res.json()) as { token: string };
    token = data.token;
    cachedToken.value = token;
  }
  let clientParams: EncodedParam[] = [];
  try {
    clientParams =
      paramMapper.value?.encode(paramValues.value, {
        only: ["store_id", "date_range", "product_category"],
      }) ?? [];
  } catch (err) {
    // skip retries if params are invalid
    ctx.markNonRetryable();
    throw err;
  }
  return {
    token,
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

/** form handlers */
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

const productCategoryArray = computed(
  () => paramValues.value.product_category ?? []
);

const updateProductCategory = (index: number, value: string): void => {
  const arr = [...(paramValues.value.product_category ?? [])];
  arr[index] = value;
  paramValues.value = {
    ...paramValues.value,
    product_category: arr,
  };
};

const addProductCategory = (): void => {
  paramValues.value = {
    ...paramValues.value,
    product_category: [...(paramValues.value.product_category ?? []), ""],
  };
};

const removeProductCategory = (index: number): void => {
  const arr = [...(paramValues.value.product_category ?? [])];
  arr.splice(index, 1);
  paramValues.value = {
    ...paramValues.value,
    product_category: arr,
  };
};
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
      </select>
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
      <label class="form-label small mb-1">Product Category</label>
      <div
        v-for="(item, index) in productCategoryArray"
        :key="index"
        class="input-group input-group-sm mb-2"
      >
        <input
          :value="item"
          type="text"
          class="form-control form-control-sm"
          placeholder="Category"
          @input="
            updateProductCategory(
              index,
              ($event.target as HTMLInputElement).value
            )
          "
        />
        <button
          type="button"
          class="btn btn-outline-secondary"
          aria-label="Remove"
          @click="removeProductCategory(index)"
        >
          ×
        </button>
      </div>
      <button
        type="button"
        class="btn btn-outline-secondary btn-sm"
        @click="addProductCategory"
      >
        + Add category
      </button>
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
      :displayOptions="{ hideParamsForm: true }"
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
