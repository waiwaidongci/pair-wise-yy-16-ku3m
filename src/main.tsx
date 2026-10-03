import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { OverlayProvider } from "./state/OverlayContext";
import { FilterProvider } from "./state/FilterContext";
import { LightboxProvider } from "./state/LightboxContext";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <OverlayProvider>
        <FilterProvider>
          <LightboxProvider>
            <App />
          </LightboxProvider>
        </FilterProvider>
      </OverlayProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
