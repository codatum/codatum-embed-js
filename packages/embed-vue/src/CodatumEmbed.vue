<script setup lang="ts">
import {
  CodatumEmbed,
  CodatumEmbedError,
  CodatumEmbedErrorCodes,
  CodatumEmbedStatuses,
} from "@codatum/embed";
import type {
  CodatumEmbedInstance,
  CodatumEmbedStatus,
  DisplayOptions,
  ExecuteSqlsTriggeredMessage,
  IframeOptions,
  ParamChangedMessage,
  TokenOptions,
  TokenProviderContext,
  TokenProviderResult,
} from "@codatum/embed";
import { onUnmounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    embedUrl: string;
    tokenProvider: (
      context: TokenProviderContext
    ) => Promise<TokenProviderResult>;
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
  error: [err: CodatumEmbedError];
}>();

const containerRef = ref<HTMLElement | null>(null);
const instance = ref<CodatumEmbedInstance | null>(null);
const status = ref<CodatumEmbedStatus>(CodatumEmbedStatuses.INITIALIZING);
const error = ref<CodatumEmbedError | null>(null);

let stopWatch: (() => void) | undefined;
stopWatch = watch(
  containerRef,
  (el: HTMLElement | null) => {
    if (!el) return;
    error.value = null;
    status.value = CodatumEmbedStatuses.INITIALIZING;
    CodatumEmbed.init({
      container: el,
      embedUrl: props.embedUrl,
      tokenProvider: props.tokenProvider,
      iframeOptions: props.iframeOptions,
      tokenOptions: {
        ...props.tokenOptions,
        onRefreshError: (err: CodatumEmbedError) => {
          props.tokenOptions?.onRefreshError?.(err);
          emit("error", err);
        },
      },
      displayOptions: props.displayOptions,
    })
      .then((emb: CodatumEmbedInstance) => {
        instance.value = emb;
        status.value = emb.status;
      })
      .catch((err: unknown) => {
        error.value =
          err instanceof CodatumEmbedError
            ? err
            : new CodatumEmbedError(
                CodatumEmbedErrorCodes.TOKEN_PROVIDER_FAILED,
                err instanceof Error ? err.message : String(err),
                { cause: err }
              );
        status.value = CodatumEmbedStatuses.DESTROYED;
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
  status.value = CodatumEmbedStatuses.DESTROYED;
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

watch(error, (err: CodatumEmbedError | null) => {
  if (err) emit("error", err);
});

const reload = async (): Promise<boolean> => {
  const inst = instance.value;
  if (!inst) return false;
  try {
    await inst.reload();
    return true;
  } catch (err: unknown) {
    error.value =
      err instanceof CodatumEmbedError
        ? err
        : new CodatumEmbedError(
            CodatumEmbedErrorCodes.TOKEN_PROVIDER_FAILED,
            err instanceof Error ? err.message : String(err),
            { cause: err }
          );
    return false;
  }
};

defineExpose({
  reload,
  status,
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
