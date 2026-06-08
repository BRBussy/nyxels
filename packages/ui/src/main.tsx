import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConfigContextProvider } from "./contexts/ConfigContext.tsx";
import { WalletContextProvider } from "./contexts/WalletContext.tsx";

import App from "./App.tsx";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error('Missing #root element in index.html');

createRoot(root).render(
  <StrictMode>
    <ConfigContextProvider>
      <WalletContextProvider>
        <App />
      </WalletContextProvider>
    </ConfigContextProvider>
  </StrictMode>,
);
