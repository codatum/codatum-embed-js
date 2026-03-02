import type {
  DevOptions,
  DisplayOptions,
  EmbedInstance,
  EmbedStatus,
  ExecuteSqlsTriggeredMessage,
  IframeOptions,
  ParamChangedMessage,
  StatusChangedPayload,
  TokenOptions,
  TokenProviderContext,
  TokenProviderResult,
} from "@codatum/embed";
import { createEmbed, EmbedError, EmbedErrorCodes, EmbedStatuses } from "@codatum/embed";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

const DEFAULT_SHOW_LOADING_ON: EmbedStatus[] = [
  EmbedStatuses.INITIALIZING,
  EmbedStatuses.RELOADING,
  EmbedStatuses.REFRESHING,
];

const toEmbedError = (err: unknown): EmbedError =>
  err instanceof EmbedError
    ? err
    : new EmbedError(
        EmbedErrorCodes.UNEXPECTED_ERROR,
        err instanceof Error ? err.message : String(err),
        { cause: err },
      );

export type EmbedReactProps = Omit<ComponentPropsWithoutRef<"div">, "children" | "onError"> & {
  embedUrl: string;
  tokenProvider: (context: TokenProviderContext) => Promise<TokenProviderResult>;
  iframeOptions?: IframeOptions;
  tokenOptions?: TokenOptions;
  displayOptions?: DisplayOptions;
  devOptions?: DevOptions;
  showLoadingOn?: EmbedStatus[];
  renderLoading?: (props: { status: EmbedStatus }) => ReactNode;
  onStatusChanged?: (payload: StatusChangedPayload) => void;
  onParamChanged?: (payload: ParamChangedMessage) => void;
  onExecuteSqlsTriggered?: (payload: ExecuteSqlsTriggeredMessage) => void;
  onError?: (err: EmbedError) => void;
};

export interface EmbedReactRef {
  reload: () => Promise<boolean>;
  status: EmbedStatus;
}

const defaultClassName = "codatum-embed-react-container";

export const Embed = forwardRef<EmbedReactRef, EmbedReactProps>(function Embed(
  {
    embedUrl,
    tokenProvider,
    iframeOptions,
    tokenOptions,
    displayOptions,
    devOptions,
    showLoadingOn = DEFAULT_SHOW_LOADING_ON,
    renderLoading,
    onStatusChanged,
    onParamChanged,
    onExecuteSqlsTriggered,
    onError,
    className,
    style,
    ...rest
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<EmbedInstance | null>(null);
  const [status, setStatus] = useState<EmbedStatus>(EmbedStatuses.CREATED);

  const showOverlay = useMemo(
    () => !!renderLoading && showLoadingOn.includes(status),
    [renderLoading, showLoadingOn, status],
  );

  // Control iframe visibility: hide when showOverlay so renderLoading is visible
  useEffect(() => {
    const iframe = instanceRef.current?.iframe;
    if (iframe) {
      iframe.style.visibility = showOverlay ? "hidden" : "";
    }
  }, [showOverlay]);

  const callbacksRef = useRef({
    onParamChanged,
    onExecuteSqlsTriggered,
    onStatusChanged,
    onError,
  });
  callbacksRef.current = {
    onParamChanged,
    onExecuteSqlsTriggered,
    onStatusChanged,
    onError,
  };

  const setError = useCallback((err: unknown) => {
    const embedError = toEmbedError(err);
    callbacksRef.current.onError?.(embedError);
  }, []);

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
      devOptions,
    });

    instanceRef.current = embed;
    setStatus(EmbedStatuses.INITIALIZING);

    embed.on("statusChanged", (payload) => {
      callbacksRef.current.onStatusChanged?.(payload);
      setStatus(payload.status);
    });
    embed.on("paramChanged", (payload) => callbacksRef.current.onParamChanged?.(payload));
    embed.on("executeSqlsTriggered", (payload) =>
      callbacksRef.current.onExecuteSqlsTriggered?.(payload),
    );

    let cancelled = false;
    embed
      .init()
      .then(() => {
        if (!cancelled && instanceRef.current === embed) {
          setStatus(embed.status);
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

  const mergedClassName =
    className !== undefined && className !== ""
      ? `${defaultClassName} ${className}`.trim()
      : defaultClassName;

  return (
    <div
      ref={containerRef}
      className={mergedClassName}
      style={{ position: "relative", width: "100%", height: "100%", ...style }}
      {...rest}
    >
      {showOverlay && renderLoading && (
        <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>{renderLoading({ status })}</div>
      )}
    </div>
  );
});
