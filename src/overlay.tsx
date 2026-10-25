import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { SubtitleOverlay } from "./components/SubtitleOverlay";
import { useAppStore } from "./store/useAppStore";
import "./index.css";

const OverlayApp: React.FC = () => {
  const init = useAppStore((state) => state.init);

  useEffect(() => {
    init();
  }, [init]);

  return <SubtitleOverlay />;
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <OverlayApp />
  </React.StrictMode>
);
