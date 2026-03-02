import { EmbedReact, type EmbedReactRef } from "@codatum/embed-react";
import { useCallback, useRef } from "react";

const tokenProvider = async () => {
  return { token: "mock-token", params: [] };
};

export default function Mock() {
  const embedRef = useRef<EmbedReactRef>(null);
  const reloadEmbed = useCallback(async () => {
    await embedRef.current?.reload();
  }, []);

  return (
    <>
      <div className="mb-3 text-end">
        <button type="button" onClick={reloadEmbed} className="btn btn-outline-secondary">
          Reload
        </button>
      </div>
      <div className="border bg-white position-relative" style={{ height: "600px" }}>
        <EmbedReact
          ref={embedRef}
          embedUrl="https://example.com/embed"
          tokenProvider={tokenProvider}
          iframeOptions={{
            theme: "LIGHT",
            locale: "en",
            className: "react-example-iframe",
          }}
          devOptions={{ debug: true, mock: { loadingDelay: 2 }, disableValidateUrl: true }}
          renderLoading={({ status }) => (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              {/* biome-ignore lint/a11y/useSemanticElements: Bootstrap spinner uses div+role="status" for live region */}
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p
                className="mt-2 mb-0"
                style={{
                  fontSize: "0.9rem",
                  color: "var(--bs-secondary, #6c757d)",
                }}
              >
                {status === "INITIALIZING"
                  ? "Initializing…"
                  : status === "RELOADING"
                    ? "Reloading…"
                    : "Refreshing…"}
              </p>
            </div>
          )}
        />
      </div>
    </>
  );
}
