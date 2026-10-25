import React from "react";
import ReactDOM from "react-dom/client";
import { ComposePopup } from "./components/ComposePopup";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ComposePopup />
  </React.StrictMode>
);
