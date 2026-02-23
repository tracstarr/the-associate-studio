import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Catch any errors before React mounts
window.addEventListener("error", (event) => {
  console.error("[main] Uncaught error:", event.error);
  const root = document.getElementById("root");
  if (root && !root.innerHTML) {
    root.innerHTML = `<div style="padding:24px;font-family:monospace;color:#f85149;background:#0d1117;height:100vh">
      <h2 style="color:#e6edf3">Startup Error</h2>
      <pre style="white-space:pre-wrap;font-size:12px">${String(event.error?.stack || event.message)}</pre>
    </div>`;
  }
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />,
);
