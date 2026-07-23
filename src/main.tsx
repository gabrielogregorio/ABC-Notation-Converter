import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider, applyDocumentLanguage, detectInitialLang } from "./i18n/i18n";
import { App } from "./App";
import { lockLightTheme } from "./app/theme";
import "./styles/global.css";

// The app is locked to the light theme; force it before the first paint.
lockLightTheme();
// Idioma e título do documento no idioma inicial, antes do primeiro paint. Depois
// disso, quem atualiza é o evento de troca de idioma (setLang), não um efeito.
applyDocumentLanguage(detectInitialLang());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
