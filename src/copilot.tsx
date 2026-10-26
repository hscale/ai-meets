import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { CopilotOverlayWindow } from "./components/CopilotOverlayWindow";
import { useAppStore } from "./store/useAppStore";
import "./index.css";

const CopilotApp: React.FC = () => {
  const init = useAppStore((state) => state.init);

  useEffect(() => {
    init();
  }, [init]);

  return <CopilotOverlayWindow />;
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <CopilotApp />
  </React.StrictMode>
);
