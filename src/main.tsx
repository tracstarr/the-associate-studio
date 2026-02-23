import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Catch any errors before React mounts
window.addEventListener("error", (event) => {
  console.error("[main] Uncaught error:", event.error);
  const root = document.getElementById("root");
  if (root && !root.innerHTML) {
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText = "padding:24px;font-family:monospace;color:#f85149;background:#0d1117;height:100vh";
    const heading = document.createElement("h2");
    heading.style.color = "#e6edf3";
    heading.textContent = "Startup Error";
    const pre = document.createElement("pre");
    pre.style.cssText = "white-space:pre-wrap;font-size:12px";
    pre.textContent = String(event.error?.stack || event.message || "Unknown error");
    errorDiv.appendChild(heading);
    errorDiv.appendChild(pre);
    root.appendChild(errorDiv);
  }
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />,
);
