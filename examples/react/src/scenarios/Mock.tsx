import { EmbedReact } from "@codatum/embed-react";

const tokenProvider = async () => {
  return { token: "mock-token", params: [] };
};

export default function Mock() {
  return (
    <div className="border bg-white">
      <EmbedReact
        embedUrl="https://example.com/embed"
        tokenProvider={tokenProvider}
        iframeOptions={{
          theme: "LIGHT",
          locale: "en",
          className: "react-example-iframe",
          style: { height: "600px" },
        }}
        devOptions={{ debug: true, mock: true, disableValidateUrl: true }}
      />
    </div>
  );
}
