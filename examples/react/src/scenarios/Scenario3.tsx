import {
  createParamMapper,
  type DefineDecodedParams,
  type DefineParamMapper,
  type EmbedError,
  EmbedReact,
  type EmbedReactRef,
  type EncodedParam,
  RESET_TO_DEFAULT,
  type TokenProviderContext,
} from "@codatum/embed-react";
import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = "http://localhost:3100/scenario3";
type Config = {
  embedUrl: string;
  paramMapping: { [key: string]: string };
  userId: string;
  storeIds: string[];
};

const paramDefs = {
  store_id: { datatype: "STRING" },
  date_range: { datatype: "[DATE, DATE]" },
  product_category: { datatype: "STRING[]" },
} as const;

type ParamValues = DefineDecodedParams<typeof paramDefs>;
type ParamMapper = DefineParamMapper<typeof paramDefs>;

export default function Scenario3() {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState("Loading config…");
  const [statusError, setStatusError] = useState(false);
  const [paramMapper, setParamMapper] = useState<ParamMapper | null>(null);
  const [paramValues, setParamValues] = useState<ParamValues>({
    store_id: undefined,
    date_range: RESET_TO_DEFAULT,
    product_category: ["Electronics"],
  });
  const embedRef = useRef<EmbedReactRef>(null);
  const paramValuesRef = useRef(paramValues);
  const paramMapperRef = useRef(paramMapper);
  const userIdRef = useRef(userId);
  paramValuesRef.current = paramValues;
  paramMapperRef.current = paramMapper;
  userIdRef.current = userId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const configRes = await fetch(`${API_URL}/config`);
        if (!configRes.ok) throw new Error(`config failed: ${configRes.status}`);
        const config: Config = await configRes.json();
        if (cancelled) return;
        setEmbedUrl(config.embedUrl);
        setUserId(config.userId);
        setStoreIds(config.storeIds);
        setParamMapper(createParamMapper(config.paramMapping, paramDefs) as ParamMapper);
        setStatusMessage("Initializing…");
      } catch (err) {
        if (!cancelled) {
          setStatusMessage(
            "Failed to fetch config. Ensure the server is running at localhost:3100.",
          );
          setStatusError(true);
          console.error(err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onReady = useCallback(() => {
    setStatusMessage("Ready");
    setStatusError(false);
  }, []);

  const tokenProvider = useCallback(async (ctx: TokenProviderContext) => {
    const currentUserId = userIdRef.current;
    const currentParamValues = paramValuesRef.current;
    const currentParamMapper = paramMapperRef.current;
    const res = await fetch(`${API_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokenUserId: currentUserId,
        params: {
          store_id: currentParamValues.store_id,
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
      currentParamMapper?.encode(currentParamValues, {
        only: ["date_range", "product_category"],
      }) ?? [];
    return {
      token: data.token,
      params: clientParams,
    };
  }, []);

  const onParamChanged = useCallback(
    (ev: { params: EncodedParam[] }) => {
      if (!paramMapper) return;
      setParamValues(paramMapper.decode(ev.params));
    },
    [paramMapper],
  );

  const onEmbedError = useCallback((err: EmbedError) => {
    setStatusMessage(err.message);
    setStatusError(true);
  }, []);

  const reloadEmbed = useCallback(async () => {
    await embedRef.current?.reload();
  }, []);

  return (
    <>
      <div className="border rounded p-3 bg-light mb-3">
        <h2 className="h6 mb-3">Parameters</h2>
        <div className="mb-2">
          <label htmlFor="store_id" className="form-label small mb-1">
            Store Id
          </label>
          <select
            id="store_id"
            value={paramValues.store_id ?? ""}
            onChange={(e) =>
              setParamValues({
                ...paramValues,
                store_id: e.target.value || undefined,
              })
            }
            className="form-control form-control-sm"
          >
            {storeIds.map((storeId) => (
              <option key={storeId} value={storeId}>
                {storeId}
              </option>
            ))}
            <option value="store3">store3(invalid)</option>
          </select>
        </div>
        <div className="text-end">
          <button type="button" onClick={reloadEmbed} className="btn btn-outline-secondary">
            Reload
          </button>
        </div>
      </div>
      <div className={`alert py-2 mb-3 ${statusError ? "alert-danger" : "alert-success"}`}>
        {statusMessage}
      </div>
      {embedUrl && (
        <div className="border bg-white">
          <EmbedReact
            ref={embedRef}
            embedUrl={embedUrl}
            tokenProvider={tokenProvider}
            iframeOptions={{
              theme: "LIGHT",
              locale: "en",
              className: "react-example-iframe",
              style: { height: "600px" },
            }}
            displayOptions={{ expandParamsFormByDefault: true }}
            onReady={onReady}
            onParamChanged={onParamChanged}
            onExecuteSqlsTriggered={onParamChanged}
            onError={onEmbedError}
          />
        </div>
      )}
    </>
  );
}
