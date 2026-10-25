import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { Dashboard } from "./components/Dashboard";
import { useAppStore } from "./store/useAppStore";
import "./index.css";

const App: React.FC = () => {
  const init = useAppStore((state) => state.init);

  useEffect(() => {
    init();
  }, [init]);

  return <Dashboard />;
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
