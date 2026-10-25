import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { prepareTelegram } from "./telegram";
import "./styles.css";

prepareTelegram();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
