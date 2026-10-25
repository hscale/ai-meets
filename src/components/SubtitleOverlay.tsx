import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAppStore } from "../store/useAppStore";
import { CopilotCard } from "./CopilotCard";
import { AudioVisualizer } from "./AudioVisualizer";
import { Lock, Unlock, Sparkles, Move, Maximize2, Minimize2 } from "lucide-react";

export const SubtitleOverlay: React.FC = () => {
  const {
    subtitles,
    latestSuggestion,
    overlayLocked,
    setOverlayLocked,
    audioLevel,
    status,
    askCopilotManual,
  } = useAppStore();

  const [showCopilot, setShowCopilot] = useState(true);
  const [fontSize, setFontSize] = useState<"sm" | "md" | "lg">("md");

  const fontClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const recentSubtitles = subtitles.slice(-2);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Automatically adjust window height to tightly hug content without dead padding/margin
  React.useLayoutEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = Math.ceil(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height);
        if (height >= 60) {
          invoke("resize_overlay", { height }).catch(() => {});
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleStartDrag = async (e: React.MouseEvent) => {
    // Only drag on primary (left) button and not on interactive buttons/selectors
    if (e.button === 0 && !(e.target as HTMLElement).closest("button, select, input, a")) {
      try {
        await invoke("drag_window");
      } catch (err) {
        try {
          await getCurrentWindow().startDragging();
        } catch (e2) {
          console.warn("Failed to drag overlay window:", e2);
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col select-none font-sans bg-transparent m-0 p-0 overflow-hidden"
    >
      {/* Optional Floating Copilot Card Drawer */}
      {showCopilot && latestSuggestion && (
        <div
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className="mb-1.5 w-full transition-all duration-200"
        >
          <CopilotCard suggestion={latestSuggestion} onAskManual={askCopilotManual} compact />
        </div>
      )}

      {/* Main Subtitle Container */}
      <div className="w-full bg-slate-950/95 backdrop-blur-2xl border border-slate-700/70 rounded-2xl p-3 shadow-2xl relative group">
        {/* Top Control Bar (Draggable) */}
        <div
          onMouseDown={handleStartDrag}
          data-tauri-drag-region="deep"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/60 cursor-move text-xs text-slate-400 select-none"
        >
          <div className="flex items-center gap-2 pointer-events-none select-none">
            <Move className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-200 tracking-wide">Live Subtitles</span>
            <AudioVisualizer level={audioLevel} active={status.is_recording} />
          </div>

          <div
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className="flex items-center gap-1.5"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Font size picker */}
            <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
              {(["sm", "md", "lg"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFontSize(s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold transition cursor-pointer ${
                    fontSize === s ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Copilot Drawer Toggle */}
            <button
              type="button"
              onClick={() => setShowCopilot(!showCopilot)}
              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                showCopilot
                  ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-300"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
              title="Toggle AI Copilot"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>

            {/* Click-through lock */}
            <button
              type="button"
              onClick={() => setOverlayLocked(!overlayLocked)}
              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                overlayLocked
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
              title={overlayLocked ? "Click-through is locked (Unlock from Dashboard or Menu)" : "Lock click-through"}
            >
              {overlayLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Subtitles Stream */}
        <div
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className="space-y-2 min-h-[50px] flex flex-col justify-end"
        >
          {recentSubtitles.length > 0 ? (
            recentSubtitles.map((sub) => (
              <div key={sub.id} className="animate-fade-in space-y-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                      sub.speaker === "Me" ? "bg-emerald-500/20 text-emerald-300" : "bg-sky-500/20 text-sky-300"
                    }`}
                  >
                    {sub.speaker}
                  </span>
                  {sub.is_question && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                      ❓ Question
                    </span>
                  )}
                  <span className="text-xs text-slate-400 italic">{sub.src_text}</span>
                </div>
                <div className={`font-semibold text-slate-100 ${fontClasses[fontSize]} leading-snug`}>
                  {sub.tgt_text}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-2 text-slate-400 text-xs italic">
              Subtitles ready. Speaking or system audio will translate here in real time...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
