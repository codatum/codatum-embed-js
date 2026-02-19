import { createEmbed, EmbedError, EmbedErrorCodes, EmbedStatuses } from "@codatum/embed";
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
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

const toEmbedError = (err: unknown): EmbedError =>
  err instanceof EmbedError
    ? err
    : new EmbedError(
        EmbedErrorCodes.TOKEN_PROVIDER_FAILED,
        err instanceof Error ? err.message : String(err),
        { cause: err },
      );

export interface EmbedReactProps {
  embedUrl: string;
  tokenProvider: (context: TokenProviderContext) => Promise<TokenProviderResult>;
  iframeOptions?: IframeOptions;
  tokenOptions?: TokenOptions;
  displayOptions?: DisplayOptions;
  onReady?: () => void;
  onParamChanged?: (payload: ParamChangedMessage) => void;
  onExecuteSqlsTriggered?: (payload: ExecuteSqlsTriggeredMessage) => void;
  onError?: (err: EmbedError) => void;
}

export interface EmbedReactRef {
  reload: () => Promise<boolean>;
  status: EmbedStatus;
}

export const Embed = forwardRef<EmbedReactRef, EmbedReactProps>(function Embed(
  {
    embedUrl,
    tokenProvider,
    iframeOptions,
    tokenOptions,
    displayOptions,
    onReady,
    onParamChanged,
    onExecuteSqlsTriggered,
    onError,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<EmbedInstance | null>(null);
  const [status, setStatus] = useState<EmbedStatus>(EmbedStatuses.CREATED);

  const setError = useCallback(
    (err: unknown) => {
      const embedError = toEmbedError(err);
      onError?.(embedError);
    },
    [onError],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only init, same as embed-vue
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const embed = createEmbed({
      container: el,
      embedUrl,
      tokenProvider,
      iframeOptions,
      tokenOptions: {
        ...tokenOptions,
        onRefreshError: (err: EmbedError) => {
          tokenOptions?.onRefreshError?.(err);
          setError(err);
        },
      },
      displayOptions,
    });

    instanceRef.current = embed;
    setStatus(EmbedStatuses.INITIALIZING);

    embed.on("paramChanged", (payload) => onParamChanged?.(payload));
    embed.on("executeSqlsTriggered", (payload) => onExecuteSqlsTriggered?.(payload));

    let cancelled = false;
    embed
      .init()
      .then(() => {
        if (!cancelled && instanceRef.current === embed) {
          setStatus(embed.status);
          onReady?.();
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err);
          setStatus(EmbedStatuses.DESTROYED);
        }
      });

    return () => {
      cancelled = true;
      if (instanceRef.current === embed) {
        embed.destroy();
        instanceRef.current = null;
      }
      setStatus(EmbedStatuses.DESTROYED);
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      get status() {
        return status;
      },
      reload: async (): Promise<boolean> => {
        const inst = instanceRef.current;
        if (!inst) return false;
        try {
          await inst.reload();
          setStatus(inst.status);
          return true;
        } catch (err: unknown) {
          setError(err);
          return false;
        }
      },
    }),
    [status, setError],
  );

  return <div ref={containerRef} className="codatum-embed-react-container" />;
});
