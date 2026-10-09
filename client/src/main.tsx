import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// The phone app is installable; the worker only keeps its own files (see public/sw.js)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// A tapped push notification asks the open app to move to its screen
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "navigate" && typeof event.data.url === "string" && event.data.url.startsWith("/")) {
      window.history.pushState(null, "", event.data.url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  });
}
