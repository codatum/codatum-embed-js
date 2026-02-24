import {
  createParamMapper,
  type DefineDecodedParams,
  type DefineParamMapper,
  type EmbedError,
  EmbedReact,
  type EmbedReactRef,
  type EncodedParam,
  RESET_TO_DEFAULT,
} from "@codatum/embed-react";
import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = "http://localhost:3100/scenario1";
type Config = {
  embedUrl: string;
  paramMapping: { [key: string]: string };
  userId: string;
};

const paramDefs = {
  store_id: { datatype: "STRING" },
  date_range: { datatype: "[DATE, DATE]" },
  product_category: { datatype: "STRING[]" },
} as const;

type ParamValues = DefineDecodedParams<typeof paramDefs>;
type ParamMapper = DefineParamMapper<typeof paramDefs>;

export default function Scenario1() {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Loading config…");
  const [statusError, setStatusError] = useState(false);
  const [paramMapper, setParamMapper] = useState<ParamMapper | null>(null);
  const [paramValues, setParamValues] = useState<ParamValues>({
    store_id: undefined,
    date_range: RESET_TO_DEFAULT,
    product_category: [],
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

  const tokenProvider = useCallback(async () => {
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
    const success = await embedRef.current?.reload();
    if (success) {
      setStatusMessage("Reloaded");
      setStatusError(false);
    }
  }, []);

  return (
    <>
      <div className="mb-3 text-end">
        <button type="button" onClick={reloadEmbed} className="btn btn-outline-secondary">
          Reload
        </button>
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
            devOptions={{ debug: true, disableValidateUrl: true }}
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
