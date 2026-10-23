/**
 * Entry point.
 *
 * Four stylesheets in a deliberate order: tokens, then the component layer, then
 * the surfaces, then the marketing page. Providers are nested so that the live
 * channel only opens once somebody is signed in, and so the palette and the
 * copilot sit above every route.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./demo/polyfills";
import "./styles/theme.css";
import "./styles/app.css";
import "./styles/surfaces.css";
import "./styles/auth.css";
import "./styles/landing.css";
import "./styles/overhaul.css";
import "./styles/landing-redesign.css";

import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("The #root element is missing from index.html");
document.documentElement.lang ||= "en";

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
