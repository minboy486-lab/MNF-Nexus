import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "../shared/themes.css";
import "../shared/broadcast.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
