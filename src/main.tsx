import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AccountProvider } from "./lib/account";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AccountProvider>
      <App />
    </AccountProvider>
  </StrictMode>,
);
