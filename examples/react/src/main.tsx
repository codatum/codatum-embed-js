/**
 * React example for @codatum/embed-react.
 * Start examples/server and set config.json before running.
 */

import { createRoot } from "react-dom/client";
import App from "./App";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");
createRoot(rootEl).render(<App />);
