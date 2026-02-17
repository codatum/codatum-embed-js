<script setup lang="ts">
import { CodatumEmbed as CodatumEmbedCore } from "@codatum/embed";
import type {
  CodatumEmbedInstance,
  DisplayOptions,
  IframeOptions,
  TokenProviderResult,
  TokenOptions,
  ParamChangedMessage,
  ExecuteSqlsTriggeredMessage,
} from "@codatum/embed";
import { onUnmounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    embedUrl: string;
    tokenProvider: () => Promise<TokenProviderResult>;
    iframeOptions?: IframeOptions;
    tokenOptions?: TokenOptions;
    displayOptions?: DisplayOptions;
  }>(),
  {}
);

const emit = defineEmits<{
  paramChanged: [payload: ParamChangedMessage];
  executeSqlsTriggered: [payload: ExecuteSqlsTriggeredMessage];
  ready: [];
  error: [err: Error];
}>();

const containerRef = ref<HTMLElement | null>(null);
const instance = ref<CodatumEmbedInstance | null>(null);
const status = ref<"initializing" | "ready" | "destroyed">("initializing");
const error = ref<Error | null>(null);

let stopWatch: (() => void) | undefined;
stopWatch = watch(
  containerRef,
  (el: HTMLElement | null) => {
    if (!el) return;
    error.value = null;
    status.value = "initializing";
    CodatumEmbedCore.init({
      container: el,
      embedUrl: props.embedUrl,
      tokenProvider: props.tokenProvider,
      iframeOptions: props.iframeOptions,
      tokenOptions: props.tokenOptions,
      displayOptions: props.displayOptions,
    })
      .then((emb: CodatumEmbedInstance) => {
        instance.value = emb;
        status.value = emb.status;
      })
      .catch((err: unknown) => {
        error.value = err instanceof Error ? err : new Error(String(err));
        status.value = "destroyed";
      });
  },
  { immediate: true }
);

onUnmounted(() => {
  stopWatch?.();
  if (instance.value) {
    instance.value.destroy();
    instance.value = null;
  }
  status.value = "destroyed";
});

watch(instance, (inst: CodatumEmbedInstance | null) => {
  if (!inst) return;
  const onParamChanged = (payload: ParamChangedMessage) =>
    emit("paramChanged", payload);
  const onExecuteSqlsTriggered = (payload: ExecuteSqlsTriggeredMessage) =>
    emit("executeSqlsTriggered", payload);
  inst.on("paramChanged", onParamChanged);
  inst.on("executeSqlsTriggered", onExecuteSqlsTriggered);
  emit("ready");
  return () => {
    inst.off("paramChanged", onParamChanged);
    inst.off("executeSqlsTriggered", onExecuteSqlsTriggered);
  };
});

watch(error, (err: Error | null) => {
  if (err) emit("error", err);
});

defineExpose({
  /** Embed instance (e.g. for calling reload). */
  instance,
  status,
  error,
});
</script>

<template>
  <div ref="containerRef" class="codatum-embed-vue-container" />
</template>

<style scoped>
.codatum-embed-vue-container {
  display: contents;
}
</style>
