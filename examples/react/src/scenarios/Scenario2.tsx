import {
  createParamMapper,
  type DefineDecodedParams,
  type DefineParamMapper,
  type EmbedError,
  EmbedReact,
  type EmbedReactRef,
  type EmbedStatus,
  type EncodedParam,
  RESET_TO_DEFAULT,
  type TokenProviderContext,
} from "@codatum/embed-react";
import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = "http://localhost:3100/scenario2";
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

export default function Scenario2() {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [embedStatus, setEmbedStatus] = useState<EmbedStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [paramMapper, setParamMapper] = useState<ParamMapper | null>(null);
  const [paramValues, setParamValues] = useState<ParamValues>({
    store_id: undefined,
    date_range: RESET_TO_DEFAULT,
    product_category: [],
  });
  const cachedTokenRef = useRef<string | null>(null);
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
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(
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

  const onStatusChanged = useCallback((payload: { status: EmbedStatus }) => {
    setEmbedStatus(payload.status);
    if (payload.status === "READY") {
      setStatusError(false);
      setErrorMessage(null);
    }
  }, []);

  const tokenProvider = useCallback(async (ctx: TokenProviderContext) => {
    let token = cachedTokenRef.current;
    if (!token) {
      const res = await fetch(`${API_URL}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenUserId: userIdRef.current,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? "Token issuance failed");
      }
      const data = (await res.json()) as { token: string };
      token = data.token;
      cachedTokenRef.current = token;
    }
    let clientParams: EncodedParam[] = [];
    try {
      clientParams =
        paramMapperRef.current?.encode(paramValuesRef.current, {
          only: ["store_id", "date_range", "product_category"],
        }) ?? [];
    } catch (err) {
      ctx.markNonRetryable();
      throw err;
    }
    return {
      token,
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
    setErrorMessage(err.message);
    setStatusError(true);
  }, []);

  const reloadEmbed = useCallback(async () => {
    await embedRef.current?.reload();
  }, []);

  const statusDisplay =
    statusError && errorMessage
      ? errorMessage
      : (embedStatus ?? (embedUrl ? "—" : "Loading config…"));

  const dateRangeStart =
    paramValues.date_range === RESET_TO_DEFAULT ? "" : (paramValues.date_range?.[0] ?? "");
  const dateRangeEnd =
    paramValues.date_range === RESET_TO_DEFAULT ? "" : (paramValues.date_range?.[1] ?? "");
  const productCategoryArray =
    paramValues.product_category === RESET_TO_DEFAULT ? [] : (paramValues.product_category ?? []);

  const setDateRangeStart = (v: string) => {
    const prev = paramValues.date_range ?? ["", ""];
    setParamValues({
      ...paramValues,
      date_range: [v, prev[1] ?? ""],
    });
  };
  const setDateRangeEnd = (v: string) => {
    const prev = paramValues.date_range ?? ["", ""];
    setParamValues({
      ...paramValues,
      date_range: [prev[0] ?? "", v],
    });
  };
  const updateProductCategory = (index: number, value: string) => {
    const arr = [...(paramValues.product_category ?? [])];
    arr[index] = value;
    setParamValues({
      ...paramValues,
      product_category: arr,
    });
  };
  const addProductCategory = () => {
    setParamValues({
      ...paramValues,
      product_category: [...(paramValues.product_category ?? []), ""],
    });
  };
  const removeProductCategory = (index: number) => {
    const arr = [...(paramValues.product_category ?? [])];
    arr.splice(index, 1);
    setParamValues({
      ...paramValues,
      product_category: arr,
    });
  };

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
          </select>
        </div>
        <div className="mb-2">
          <label htmlFor="date_range" className="form-label small mb-1">
            Date Range
          </label>
          <div className="row g-2">
            <div className="col">
              <input
                id="date_range-start"
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
                type="text"
                className="form-control form-control-sm"
                placeholder="Start"
              />
            </div>
            <div className="col">
              <input
                id="date_range-end"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
                type="text"
                className="form-control form-control-sm"
                placeholder="End"
              />
            </div>
          </div>
        </div>
        <fieldset className="mb-3 border-0 p-0">
          <legend className="form-label small mb-1">Product Category</legend>
          {productCategoryArray.map((item, index) => (
            <div key={index} className="input-group input-group-sm mb-2">
              <input
                value={item}
                type="text"
                className="form-control form-control-sm"
                placeholder="Category"
                onChange={(e) => updateProductCategory(index, e.target.value)}
              />
              <button
                type="button"
                className="btn btn-outline-secondary"
                aria-label="Remove"
                onClick={() => removeProductCategory(index)}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={addProductCategory}
          >
            + Add category
          </button>
        </fieldset>
        <div className="text-end">
          <button type="button" onClick={reloadEmbed} className="btn btn-outline-secondary">
            Reload
          </button>
        </div>
      </div>
      <div className={`alert py-2 mb-3 ${statusError ? "alert-danger" : "alert-success"}`}>
        {statusDisplay}
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
            displayOptions={{ hideParamsForm: true }}
            devOptions={{ debug: true, disableValidateUrl: true }}
            onStatusChanged={onStatusChanged}
            onParamChanged={onParamChanged}
            onExecuteSqlsTriggered={onParamChanged}
            onError={onEmbedError}
          />
        </div>
      )}
    </>
  );
}
