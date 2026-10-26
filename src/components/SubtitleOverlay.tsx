import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAppStore } from "../store/useAppStore";
import { CopilotCard } from "./CopilotCard";
import { AudioVisualizer } from "./AudioVisualizer";
import {
  Lock,
  Unlock,
  Sparkles,
  Move,
  Copy,
  Check,
  Pencil,
  X,
  Globe,
  Layers,
  ExternalLink,
} from "lucide-react";

export const SubtitleOverlay: React.FC = () => {
  const {
    subtitles,
    latestSuggestion,
    overlayLocked,
    setOverlayLocked,
    setOverlayVisible,
    audioLevel,
    status,
    askCopilotManual,
    transcriptionMode,
    setTranscriptionMode,
    updateSubtitle,
    isCopilotSplit,
    copilotVisible,
    toggleCopilotVisible,
    setCopilotSplit,
    toggleCopilotSplit,
    fontSize,
    setFontSize,
  } = useAppStore();

  const [showCopilot, setShowCopilot] = useState(false);

  // Inline editing state for HUD
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSrcText, setEditSrcText] = useState("");
  const [editTgtText, setEditTgtText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Automatically open Copilot drawer when a question suggestion arrives
  React.useEffect(() => {
    if (latestSuggestion) {
      setShowCopilot(true);
    }
  }, [latestSuggestion]);

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
  }, [editingId, showCopilot, transcriptionMode, recentSubtitles]);

  const handleStartDrag = async (e: React.MouseEvent) => {
    // Only drag on primary (left) button and not on interactive buttons/selectors/inputs
    if (e.button === 0 && !(e.target as HTMLElement).closest("button, select, input, textarea, a")) {
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

  const handleCopySubtitle = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startEditing = (sub: (typeof subtitles)[0]) => {
    setEditingId(sub.id);
    setEditSrcText(sub.src_text);
    setEditTgtText(sub.tgt_text);
  };

  const saveEditing = async (id: string) => {
    if (editTgtText.trim()) {
      await updateSubtitle(id, editSrcText.trim(), editTgtText.trim());
    }
    setEditingId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col font-sans bg-transparent m-0 p-0 overflow-hidden"
    >
      {/* Floating Copilot Card Drawer (Only when docked with Subtitles) */}
      {showCopilot && !isCopilotSplit && (
        <div
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className="mb-1.5 w-full transition-all duration-200"
        >
          <div className="relative">
            <CopilotCard
              suggestion={latestSuggestion}
              onAskManual={askCopilotManual}
              onClose={() => setShowCopilot(false)}
              compact
            />
            <button
              type="button"
              onClick={() => setCopilotSplit(true)}
              className="absolute top-3 right-10 text-[10px] text-indigo-300 hover:text-white bg-slate-800/90 hover:bg-slate-700 px-1.5 py-0.5 rounded border border-indigo-500/40 flex items-center gap-1 cursor-pointer transition shadow-xs"
              title="Split Copilot into independent floating box (Unhinge from Subtitles)"
            >
              <ExternalLink className="w-2.5 h-2.5" /> Split Box
            </button>
          </div>
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
            {/* Translation Mode Picker (Bilingual vs Single) */}
            <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-[10px]">
              <button
                type="button"
                onClick={() => setTranscriptionMode("bilingual")}
                className={`px-1.5 py-0.5 rounded font-bold transition cursor-pointer flex items-center gap-0.5 ${
                  transcriptionMode === "bilingual"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Bilingual Mode: Show both translated and source spoken text"
              >
                <Globe className="w-2.5 h-2.5" /> BI
              </button>
              <button
                type="button"
                onClick={() => setTranscriptionMode("single")}
                className={`px-1.5 py-0.5 rounded font-bold transition cursor-pointer ${
                  transcriptionMode === "single"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Single Mode: Show translated subtitles only"
              >
                SINGLE
              </button>
            </div>

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

            {/* Split / Dock Mode Button */}
            <button
              type="button"
              onClick={() => toggleCopilotSplit()}
              className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                isCopilotSplit
                  ? "bg-indigo-950/70 border-indigo-500/50 text-indigo-300"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
              title={
                isCopilotSplit
                  ? "Currently Split into 2 boxes. Click to Dock Copilot with Subtitles."
                  : "Currently Glued/Docked in 1 box. Click to Split into 2 independent boxes."
              }
            >
              {isCopilotSplit ? <Layers className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
            </button>

            {/* Copilot Window / Drawer Toggle */}
            <button
              type="button"
              onClick={() => {
                if (isCopilotSplit) {
                  toggleCopilotVisible();
                } else {
                  setShowCopilot(!showCopilot);
                }
              }}
              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                (isCopilotSplit ? copilotVisible : showCopilot)
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-600/30"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
              title={
                isCopilotSplit
                  ? copilotVisible
                    ? "Hide AI Copilot Window"
                    : "Show AI Copilot Window"
                  : showCopilot
                  ? "Hide AI Copilot Drawer"
                  : "Show AI Copilot Drawer"
              }
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

            {/* Close / Hide Live Subtitles */}
            <button
              type="button"
              onClick={() => setOverlayVisible(false)}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              title="Close Live Subtitles (Reopen anytime from Dashboard or Tray)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Subtitles Stream */}
        <div
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className="space-y-2 min-h-[50px] flex flex-col justify-end select-text cursor-text"
        >
          {recentSubtitles.length > 0 ? (
            recentSubtitles.map((sub) => {
              const isEditing = editingId === sub.id;

              if (isEditing) {
                return (
                  <div
                    key={sub.id}
                    className="p-2 rounded-xl bg-slate-900/90 border border-indigo-500/50 space-y-1.5 select-auto"
                  >
                    <div className="flex items-center justify-between text-[10px] text-indigo-300 font-semibold">
                      <span>Editing Utterance ({sub.speaker}):</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => saveEditing(sub.id)}
                          className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Check className="w-3 h-3" /> Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={editTgtText}
                      onChange={(e) => setEditTgtText(e.target.value)}
                      placeholder="Translated text..."
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      value={editSrcText}
                      onChange={(e) => setEditSrcText(e.target.value)}
                      placeholder="Original spoken text..."
                      className="w-full bg-slate-950/70 border border-slate-800 rounded px-2 py-0.5 text-[11px] text-slate-300 italic focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                );
              }

              return (
                <div key={sub.id} className="animate-fade-in space-y-0.5 group/item">
                  <div className="flex items-center justify-between gap-2">
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
                      {sub.is_edited && (
                        <span className="text-[9px] font-medium px-1 rounded bg-slate-800 text-indigo-300 border border-indigo-500/30">
                          Edited
                        </span>
                      )}
                      {transcriptionMode === "bilingual" && (
                        <span className="text-xs text-slate-400 italic select-text">{sub.src_text}</span>
                      )}
                    </div>

                    {/* Quick action buttons (Copy / Edit) */}
                    <div className="flex items-center gap-1 opacity-80 group-hover/item:opacity-100 transition">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopySubtitle(
                            sub.id,
                            transcriptionMode === "bilingual"
                              ? `${sub.src_text}\n${sub.tgt_text}`
                              : sub.tgt_text
                          )
                        }
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                        title="Copy subtitle text"
                      >
                        {copiedId === sub.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditing(sub)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                        title="Edit transcription text"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Primary Translated Text */}
                  <div className={`font-semibold text-slate-100 ${fontClasses[fontSize]} leading-snug select-text`}>
                    {sub.tgt_text}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-2 text-slate-400 text-xs italic select-none">
              Subtitles ready. Speaking or system audio will translate here in real time...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
