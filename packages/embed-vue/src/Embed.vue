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
  DevOptions,
  DisplayOptions,
  ExecuteSqlsTriggeredMessage,
  IframeOptions,
  ParamChangedMessage,
  StatusChangedPayload,
  TokenOptions,
  TokenProviderContext,
  TokenProviderResult,
} from "@codatum/embed";
import { onMounted, onUnmounted, ref } from "vue";

const props = defineProps<{
  embedUrl: string;
  tokenProvider: (
    context: TokenProviderContext
  ) => Promise<TokenProviderResult>;
  iframeOptions?: IframeOptions;
  tokenOptions?: TokenOptions;
  displayOptions?: DisplayOptions;
  devOptions?: DevOptions;
}>();

const emit = defineEmits<{
  statusChanged: [payload: StatusChangedPayload];
  paramChanged: [payload: ParamChangedMessage];
  executeSqlsTriggered: [payload: ExecuteSqlsTriggeredMessage];
  error: [err: EmbedError];
}>();

const containerRef = ref<HTMLElement | null>(null);
const instance = ref<EmbedInstance | null>(null);
const status = ref<EmbedStatus>(EmbedStatuses.CREATED);

const toEmbedError = (err: unknown): EmbedError =>
  err instanceof EmbedError
    ? err
    : new EmbedError(
        EmbedErrorCodes.UNEXPECTED_ERROR,
        err instanceof Error ? err.message : String(err),
        { cause: err }
      );

const setError = (err: unknown) => {
  const embedError = toEmbedError(err);
  emit("error", embedError);
};

onMounted(async () => {
  const el = containerRef.value;
  if (!el) return;

  const embed = createEmbed({
    container: el,
    embedUrl: props.embedUrl,
    tokenProvider: props.tokenProvider,
    iframeOptions: props.iframeOptions,
    tokenOptions: {
      ...props.tokenOptions,
      onRefreshError: (err: EmbedError) => {
        props.tokenOptions?.onRefreshError?.(err);
        setError(err);
      },
    },
    displayOptions: props.displayOptions,
    devOptions: props.devOptions,
  });

  instance.value = embed;
  status.value = EmbedStatuses.INITIALIZING;

  embed.on("statusChanged", (payload) => {
    emit("statusChanged", payload);
    status.value = payload.status;
  });
  embed.on("paramChanged", (payload) => emit("paramChanged", payload));
  embed.on("executeSqlsTriggered", (payload) =>
    emit("executeSqlsTriggered", payload)
  );

  try {
    await embed.init();
    status.value = embed.status;
  } catch (err: unknown) {
    setError(err);
    status.value = EmbedStatuses.DESTROYED;
  }
});

onUnmounted(() => {
  if (instance.value) {
    instance.value.destroy();
    instance.value = null;
  }
  status.value = EmbedStatuses.DESTROYED;
});

const reload = async (): Promise<boolean> => {
  if (!instance.value) return false;
  try {
    await instance.value.reload();
    status.value = instance.value.status;
    return true;
  } catch (err: unknown) {
    setError(err);
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
