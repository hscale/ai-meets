import React, { useRef, useLayoutEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAppStore } from "../store/useAppStore";
import { CopilotCard } from "./CopilotCard";
import { Move, Lock, Unlock, ArrowDownToLine, X, Sparkles, Layers } from "lucide-react";

export const CopilotOverlayWindow: React.FC = () => {
  const {
    latestSuggestion,
    askCopilotManual,
    copilotLocked,
    setCopilotLocked,
    setCopilotVisible,
    setCopilotSplit,
  } = useAppStore();

  const containerRef = useRef<HTMLDivElement>(null);

  // Dynamically resize window height to hug card tightly without dead zones
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = Math.ceil(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height);
        if (height >= 60) {
          invoke("resize_copilot", { height }).catch(() => {});
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [latestSuggestion]);

  const handleStartDrag = async (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest("button, select, input, textarea, a")) {
      try {
        await invoke("drag_window");
      } catch (err) {
        try {
          await getCurrentWindow().startDragging();
        } catch (e2) {
          console.warn("Failed to drag copilot window:", e2);
        }
      }
    }
  };

  const handleDockWithSubtitles = async () => {
    // Dock copilot back into subtitles HUD
    await setCopilotSplit(false);
  };

  const handleClose = async () => {
    await setCopilotVisible(false);
  };

  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col font-sans bg-transparent m-0 p-0 overflow-hidden"
    >
      <div className="w-full bg-slate-950/95 backdrop-blur-2xl border border-indigo-500/50 rounded-2xl p-3 shadow-2xl relative group">
        {/* Top Control Bar (Draggable) */}
        <div
          onMouseDown={handleStartDrag}
          data-tauri-drag-region="deep"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          className="flex items-center justify-between pb-2 mb-2.5 border-b border-indigo-500/20 cursor-move text-xs text-slate-400 select-none"
        >
          <div className="flex items-center gap-2 pointer-events-none select-none">
            <Move className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold text-indigo-200 tracking-wide flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              AI Copilot
            </span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              Floating Window
            </span>
          </div>

          <div
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className="flex items-center gap-1.5"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dock into Subtitles HUD button */}
            <button
              type="button"
              onClick={handleDockWithSubtitles}
              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer flex items-center gap-1 text-[11px]"
              title="Dock Copilot into Subtitles HUD (Attach together)"
            >
              <ArrowDownToLine className="w-3 h-3 text-indigo-400" />
              <span className="hidden sm:inline">Dock with Subtitles</span>
            </button>

            {/* Click-through lock */}
            <button
              type="button"
              onClick={() => setCopilotLocked(!copilotLocked)}
              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                copilotLocked
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
              title={copilotLocked ? "Click-through is locked (Unlock from Dashboard or Tray)" : "Lock click-through"}
            >
              {copilotLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>

            {/* Close / Hide button */}
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              title="Hide AI Copilot Window"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Embedded Copilot Content */}
        <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <CopilotCard
            suggestion={latestSuggestion}
            onAskManual={askCopilotManual}
            compact
          />
        </div>
      </div>
    </div>
  );
};
