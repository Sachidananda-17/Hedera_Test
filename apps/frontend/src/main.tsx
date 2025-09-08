import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// 🔧 Polyfills for HashConnect
import { Buffer } from "buffer";
window.Buffer = Buffer;

import process from "process";
window.process = process;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
