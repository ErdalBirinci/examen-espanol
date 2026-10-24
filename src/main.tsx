import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { installErrorReporting } from "./lib/observability";
import "./index.css";

installErrorReporting();

// GitHub Pages serves the app under /<repo>/; BASE_URL (with trailing slash)
// is the correct router basename.
const basename = import.meta.env.BASE_URL.replace(/\/+$/, "");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename || "/"}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
