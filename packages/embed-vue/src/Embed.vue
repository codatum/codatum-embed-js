<script setup lang="ts">
import {
  createEmbed,
  EmbedError,
  EmbedErrorCodes,
  EmbedStatuses,
} from "@codatum/embed";
import type {
  EmbedInstance,
  EmbedStatus,
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
  error: [err: EmbedError];
}>();

const containerRef = ref<HTMLElement | null>(null);
const instance = ref<EmbedInstance | null>(null);
const status = ref<EmbedStatus>(EmbedStatuses.CREATED);
const error = ref<EmbedError | null>(null);

let stopWatch: (() => void) | undefined;
stopWatch = watch(
  containerRef,
  (el: HTMLElement | null) => {
    if (!el) return;
    error.value = null;
    const embed = createEmbed({
      container: el,
      embedUrl: props.embedUrl,
      tokenProvider: props.tokenProvider,
      iframeOptions: props.iframeOptions,
      tokenOptions: {
        ...props.tokenOptions,
        onRefreshError: (err: EmbedError) => {
          props.tokenOptions?.onRefreshError?.(err);
          emit("error", err);
        },
      },
      displayOptions: props.displayOptions,
    });
    instance.value = embed;
    status.value = EmbedStatuses.INITIALIZING;
    embed
      .init()
      .then(() => {
        status.value = embed.status;
      })
      .catch((err: unknown) => {
        error.value =
          err instanceof EmbedError
            ? err
            : new EmbedError(
                EmbedErrorCodes.TOKEN_PROVIDER_FAILED,
                err instanceof Error ? err.message : String(err),
                { cause: err }
              );
        status.value = EmbedStatuses.DESTROYED;
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
  status.value = EmbedStatuses.DESTROYED;
});

watch(instance, (inst: EmbedInstance | null) => {
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

watch(error, (err: EmbedError | null) => {
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
      err instanceof EmbedError
        ? err
        : new EmbedError(
            EmbedErrorCodes.TOKEN_PROVIDER_FAILED,
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
