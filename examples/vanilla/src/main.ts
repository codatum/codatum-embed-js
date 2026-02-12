/**
 * ESM pattern: import @codatum/embed and render signed embed.
 * Start examples/server and set config.json before running.
 */

import { CodatumEmbed } from "@codatum/embed";

const SERVER_URL = "http://localhost:3100";

const statusEl = document.getElementById("status");
const containerEl = document.getElementById("dashboard");

function setStatus(text: string, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = `alert py-2 mb-3 ${isError ? "alert-danger" : "alert-success"}`;
}

async function run() {
  if (!containerEl) {
    setStatus("Container #dashboard not found", true);
    return;
  }

  let embedUrl: string;
  try {
    const configRes = await fetch(`${SERVER_URL}/config`);
    if (!configRes.ok) throw new Error(`config failed: ${configRes.status}`);
    const config = (await configRes.json()) as { embedUrl: string };
    embedUrl = config.embedUrl;
  } catch (err) {
    setStatus("Failed to fetch config. Ensure the server is running at localhost:3100.", true);
    console.error(err);
    return;
  }

  try {
    const embed = await CodatumEmbed.init({
      container: containerEl,
      embedUrl,
      tokenProvider: async () => {
        const res = await fetch(`${SERVER_URL}/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokenUserId: "demo-user" }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { message?: string };
          throw new Error(data.message ?? "Token issuance failed");
        }
        const data = (await res.json()) as { token: string };
        return data.token;
      },
      iframeOptions: { theme: "LIGHT", locale: "en" },
      // You can pass initial param values and display options via clientSideOptions:
      // clientSideOptions: {
      //   displayOptions: { sqlDisplay: "RESULT_ONLY", expandParamsFormByDefault: false },
      //   params: [{ param_id: "xxx", param_value: "\"value\"" }],
      // },
    });

    setStatus("Ready");

    // ParamHelper example (typed params):
    // import { CodatumEmbed, createParamHelper } from "@codatum/embed";
    // const paramHelper = createParamHelper({ myParam: "686d820209183cfa1045cb81" });
    // const encoded = paramHelper.encode({ myParam: "Hello" });
    // embed.reload({ params: encoded });

    embed.on("paramChanged", (payload) => {
      console.log("[paramChanged]", payload);
    });
    embed.on("executeSqlsTriggered", (payload) => {
      console.log("[executeSqlsTriggered]", payload);
    });
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Embed initialization failed", true);
    console.error(err);
  }
}

run();
