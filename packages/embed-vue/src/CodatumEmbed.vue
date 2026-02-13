<script setup lang="ts">
import { CodatumEmbed as CodatumEmbedCore } from "@codatum/embed";
import type {
  ClientSideOptions,
  CodatumEmbedInstance,
  EncodedParam,
  IframeOptions,
  TokenOptions,
} from "@codatum/embed";
import { onUnmounted, ref, watch } from "vue";
import { useAttrs } from "vue";

const props = withDefaults(
  defineProps<{
    embedUrl: string;
    tokenProvider: () => Promise<string>;
    iframeOptions?: IframeOptions;
    tokenOptions?: TokenOptions;
    clientSideOptions?: ClientSideOptions;
  }>(),
  {}
);

const emit = defineEmits<{
  paramChanged: [payload: { params: EncodedParam[] }];
  executeSqlsTriggered: [payload: { params: EncodedParam[] }];
  ready: [];
  error: [err: Error];
}>();

const containerRef = ref<HTMLElement | null>(null);
const instance = ref<CodatumEmbedInstance | null>(null);
const status = ref<"initializing" | "ready" | "destroyed">("initializing");
const error = ref<Error | null>(null);
const isReady = ref(false);

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
      clientSideOptions: props.clientSideOptions,
    })
      .then((emb: CodatumEmbedInstance) => {
        instance.value = emb;
        status.value = emb.status;
        isReady.value = true;
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
  isReady.value = false;
});

watch(instance, (inst: CodatumEmbedInstance | null) => {
  if (!inst) return;
  const onParamChanged = (payload: { params: EncodedParam[] }) =>
    emit("paramChanged", payload);
  const onExecuteSqlsTriggered = (payload: { params: EncodedParam[] }) =>
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
  isReady,
});

const attrs = useAttrs();
const containerStyle = {
  width: "100%",
  height: "100%",
  minHeight: "300px",
  ...(typeof attrs.style === "object" &&
  attrs.style &&
  !Array.isArray(attrs.style)
    ? attrs.style
    : {}),
};
</script>

<template>
  <div
    ref="containerRef"
    class="codatum-embed-vue-container"
    :class="attrs.class"
    :style="containerStyle"
  />
</template>
