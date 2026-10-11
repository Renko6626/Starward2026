import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { I18nextProvider } from 'react-i18next';
import { siteI18n } from './i18n';
import "./index.css";
import "./portal/workspace.css";
import "./app/layouts/site-scale.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nextProvider i18n={siteI18n}><RouterProvider router={router} /></I18nextProvider>
  </StrictMode>,
);

// Common UI glyphs are in the initial stylesheet. Register uncommon characters
// after a paint; unicode-range still downloads only the shards actually needed.
requestAnimationFrame(() => requestAnimationFrame(() => {
  void import('./fonts-extended.css');
}));
