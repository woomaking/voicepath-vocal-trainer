import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { VoicePathApp } from "../components/VoicePathApp";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VoicePathApp />
  </StrictMode>,
);
