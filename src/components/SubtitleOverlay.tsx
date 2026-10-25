import React, { useState } from "react";
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

  return (
    <div className="w-full h-screen p-2 flex flex-col justify-end pointer-events-none select-none font-sans bg-transparent">
      {/* Optional Floating Copilot Card Drawer */}
      {showCopilot && latestSuggestion && (
        <div className="mb-2 max-w-xl mx-auto w-full transition-all duration-200 pointer-events-auto">
          <CopilotCard suggestion={latestSuggestion} onAskManual={askCopilotManual} compact />
        </div>
      )}

      {/* Main Subtitle Container */}
      <div className="w-full max-w-3xl mx-auto bg-slate-950/90 backdrop-blur-2xl border border-slate-700/60 rounded-2xl p-3.5 shadow-2xl relative group pointer-events-auto">
        {/* Top Control Bar (Draggable) */}
        <div
          data-tauri-drag-region
          className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/60 cursor-move text-xs text-slate-400 select-none"
        >
          <div className="flex items-center gap-2" data-tauri-drag-region>
            <Move className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-200 tracking-wide">AI Meets</span>
            <AudioVisualizer level={audioLevel} active={status.is_recording} />
          </div>

          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {/* Font size picker */}
            <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
              {(["sm", "md", "lg"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFontSize(s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold transition ${
                    fontSize === s ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Copilot Drawer Toggle */}
            <button
              onClick={() => setShowCopilot(!showCopilot)}
              className={`p-1.5 rounded-lg border transition ${
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
              onClick={() => setOverlayLocked(!overlayLocked)}
              className={`p-1.5 rounded-lg border transition ${
                overlayLocked
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
              title={overlayLocked ? "Click-through is locked" : "Lock click-through"}
            >
              {overlayLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Subtitles Stream */}
        <div className="space-y-2 min-h-[50px] flex flex-col justify-end">
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
