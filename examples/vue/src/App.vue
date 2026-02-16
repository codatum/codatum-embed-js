<script setup lang="ts">
import { CodatumEmbed, type EncodedParam } from "@codatum/embed-vue";
import { onMounted, ref, computed } from "vue";

const SERVER_URL = "http://localhost:3100";

type ParamDefs = {
  paramId: string;
  paramName: string;
  defaultValue: unknown;
  isServerSide?: boolean;
};

const embedUrl = ref<string | null>(null);
const paramDefs = ref<ParamDefs[]>([]);
const statusMessage = ref("Loading config…");
const statusError = ref(false);

const serverParamValues = ref<Record<string, unknown>>({});
const clientParamValues = ref<Record<string, unknown>>({});

const serverParams = computed(() => {
  return paramDefs.value.filter((p) => p.isServerSide);
});
const clientParams = computed(() => {
  return paramDefs.value.filter((p) => !p.isServerSide);
});

onMounted(async () => {
  try {
    const configRes = await fetch(`${SERVER_URL}/config`);
    if (!configRes.ok) throw new Error(`config failed: ${configRes.status}`);
    const config = await configRes.json();
    embedUrl.value = config.embedUrl;
    paramDefs.value = config.params;
    paramDefs.value.forEach((param) => {
      if (param.isServerSide) {
        serverParamValues.value[param.paramId] = param.defaultValue;
      } else {
        clientParamValues.value[param.paramId] = param.defaultValue;
      }
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

const sessionProvider = async () => {
  const params = serverParams.value.map((p) => {
    return {
      paramId: p.paramId,
      paramValue: serverParamValues.value[p.paramId],
    };
  });
  const res = await fetch(`${SERVER_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokenUserId: "demo-user", params }),
  });
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Token issuance failed");
  }
  const data = (await res.json()) as { token: string };
  return {
    token: data.token,
    params: clientParams.value.map((p) => ({
      param_id: p.paramId,
      param_value: JSON.stringify(clientParamValues.value[p.paramId]),
    })),
  };
};

const onParamChanged = (ev: { params: EncodedParam[] }) => {
  ev.params.forEach((p) => {
    const paramId = p.param_id;
    const clientParam = clientParams.value.find((p) => p.paramId === paramId);
    if (clientParam) {
      clientParamValues.value[clientParam.paramId] = JSON.parse(p.param_value);
    }
  });
};

const onEmbedError = (err: Error) => {
  statusMessage.value = err.message;
  statusError.value = true;
};

const embedRef = ref<InstanceType<typeof CodatumEmbed> | null>(null);
const reloadEmbed = () => {
  embedRef.value?.instance?.reload();
};
</script>

<template>
  <div class="container">
    <h1 class="h5 mb-3">Codatum Embed — Vue Example</h1>
    <div class="mb-3">
      <button
        type="button"
        @click="reloadEmbed"
        class="btn btn-outline-secondary"
      >
        reload()
      </button>
    </div>
    <div class="row g-3 mb-3">
      <div class="col-12 col-md-6">
        <div class="border rounded p-3 bg-light">
          <h2 class="h6 mb-3">Server-side parameters</h2>
          <div v-for="param in serverParams" :key="param.paramId" class="mb-2">
            <label :for="param.paramId" class="form-label small mb-1">{{
              param.paramName
            }}</label>
            <input
              :id="param.paramId"
              v-model="serverParamValues[param.paramId]"
              type="text"
              class="form-control form-control-sm"
            />
          </div>
          <p v-if="!serverParams.length" class="text-muted small mb-0">
            No server-side parameters
          </p>
        </div>
      </div>
      <div class="col-12 col-md-6">
        <div class="border rounded p-3 bg-light">
          <h2 class="h6 mb-3">Client-side parameters</h2>
          <div v-for="param in clientParams" :key="param.paramId" class="mb-2">
            <label :for="param.paramId" class="form-label small mb-1">{{
              param.paramName
            }}</label>
            <input
              :id="param.paramId"
              v-model="clientParamValues[param.paramId]"
              type="text"
              class="form-control form-control-sm"
            />
          </div>
          <p v-if="!clientParams.length" class="text-muted small mb-0">
            No client-side parameters
          </p>
        </div>
      </div>
    </div>
    <div
      class="alert py-2 mb-3"
      :class="statusError ? 'alert-danger' : 'alert-success'"
    >
      {{ statusMessage }}
    </div>
    <div v-if="embedUrl" class="border bg-white">
      <CodatumEmbed
        ref="embedRef"
        :embedUrl="embedUrl"
        :sessionProvider="sessionProvider"
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
        @executeSqlsTriggered="(e) => console.log('[executeSqlsTriggered]', e)"
        @error="onEmbedError"
      />
    </div>
  </div>
</template>
