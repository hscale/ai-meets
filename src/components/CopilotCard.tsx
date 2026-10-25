import React, { useState } from "react";
import { QuestionSuggestion } from "../types";
import { Sparkles, Copy, Check, Send, Bot, HelpCircle, X, Tag, Globe } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store/useAppStore";
import { HighlightText } from "./HighlightText";

interface CopilotCardProps {
  suggestion: QuestionSuggestion | null;
  onAskManual?: (question: string) => void;
  onClose?: () => void;
  compact?: boolean;
}

export const CopilotCard: React.FC<CopilotCardProps> = ({
  suggestion,
  onAskManual,
  onClose,
  compact = false,
}) => {
  const { copilotMode, setCopilotMode } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [isAsking, setIsAsking] = useState(false);

  const handleCopy = (specificText?: string) => {
    if (!suggestion) return;
    let textToCopy = specificText;
    if (!textToCopy) {
      if (copilotMode === "bilingual" && suggestion.sample_answer_bilingual) {
        textToCopy = `${suggestion.talking_points.map((p) => `• ${p.replace(/\*\*/g, "")}`).join("\n")}\n\nPrimary: ${suggestion.sample_answer.replace(/\*\*/g, "")}\n\nBilingual: ${suggestion.sample_answer_bilingual.replace(/\*\*/g, "")}`;
      } else {
        textToCopy = `${suggestion.talking_points.map((p) => `• ${p.replace(/\*\*/g, "")}`).join("\n")}\n\nSuggested: ${suggestion.sample_answer.replace(/\*\*/g, "")}`;
      }
    }
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAutoPaste = async (text?: string) => {
    if (!suggestion) return;
    const textToPaste = (text || suggestion.sample_answer).replace(/\*\*/g, "");
    try {
      await invoke("compose_submit", { translatedText: textToPaste });
    } catch (e) {
      console.error("Auto paste error:", e);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim() || !onAskManual) return;
    setIsAsking(true);
    try {
      await onAskManual(manualInput);
      setManualInput("");
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-indigo-500/30 bg-slate-900/95 backdrop-blur-md shadow-2xl transition-all ${
        compact ? "p-3 text-xs" : "p-4 text-sm"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-indigo-500/20 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <span className="font-semibold text-indigo-200">AI Meeting Copilot</span>

          {/* Bilingual / Single Mode Switcher */}
          <div className="flex items-center bg-slate-950/80 rounded-lg p-0.5 border border-slate-700/60 text-[10px]">
            <button
              type="button"
              onClick={() => setCopilotMode("bilingual")}
              className={`px-2 py-0.5 rounded font-medium transition cursor-pointer flex items-center gap-1 ${
                copilotMode === "bilingual"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Bilingual Mode: Show both Primary and Secondary/English responses & question translation"
            >
              <Globe className="w-3 h-3" /> Bilingual
            </button>
            <button
              type="button"
              onClick={() => setCopilotMode("single")}
              className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                copilotMode === "single"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Single Mode: Show primary response only"
            >
              Single
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {suggestion && (
            <>
              <button
                onClick={() => handleCopy()}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-xs cursor-pointer"
                title="Copy answer to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={() => handleAutoPaste()}
                className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition text-xs cursor-pointer shadow-sm shadow-indigo-600/30"
                title="Auto-paste into active app (Cmd+V)"
              >
                Auto-Paste
              </button>
            </>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
              title="Close Copilot Drawer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {suggestion ? (
        <div className="space-y-3">
          {/* Detected Question */}
          <div className="flex items-start gap-2 bg-slate-800/70 p-2.5 rounded-lg border border-slate-700/60">
            <HelpCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider">
                  Detected Question
                </div>
                {copilotMode === "bilingual" && (
                  <span className="text-[10px] text-slate-400 font-mono">Bilingual View</span>
                )}
              </div>
              <div className="text-slate-100 font-medium mt-0.5 select-text">
                <HighlightText text={suggestion.question_text} keywords={suggestion.keywords} />
              </div>

              {/* Bilingual Question Translation */}
              {copilotMode === "bilingual" && suggestion.question_translation && (
                <div className="mt-1 pt-1 border-t border-slate-700/40 text-xs text-indigo-300/90 italic flex items-center gap-1.5 select-text">
                  <span className="text-[10px] uppercase font-bold not-italic px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                    Translation
                  </span>
                  <span>{suggestion.question_translation}</span>
                </div>
              )}
            </div>
          </div>

          {/* Keywords Highlight Pills */}
          {suggestion.keywords && suggestion.keywords.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-0.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3 text-indigo-400" /> Keywords:
              </span>
              {suggestion.keywords.map((kw, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-xs"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          {/* Key Talking Points */}
          {suggestion.talking_points.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider mb-1">
                💡 Key Talking Points
              </div>
              <ul className="space-y-1">
                {suggestion.talking_points.map((pt, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-slate-200 select-text">
                    <span className="text-indigo-400 font-bold shrink-0">{idx + 1}.</span>
                    <HighlightText text={pt} keywords={suggestion.keywords} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggested Response (Primary) */}
          {suggestion.sample_answer && (
            <div className="bg-indigo-950/40 border border-indigo-500/25 rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-semibold text-indigo-300 uppercase tracking-wider">
                <span>💬 {copilotMode === "bilingual" ? "Suggested Response (Primary)" : "Suggested Response"}</span>
                {copilotMode === "bilingual" && (
                  <button
                    onClick={() => handleCopy(suggestion.sample_answer.replace(/\*\*/g, ""))}
                    className="text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer flex items-center gap-1"
                  >
                    <Copy className="w-2.5 h-2.5" /> Copy
                  </button>
                )}
              </div>
              <p className="text-slate-100 italic leading-relaxed select-text">
                "<HighlightText text={suggestion.sample_answer} keywords={suggestion.keywords} />"
              </p>
            </div>
          )}

          {/* Bilingual Alternative Response */}
          {copilotMode === "bilingual" && suggestion.sample_answer_bilingual && (
            <div className="bg-slate-800/60 border border-indigo-500/20 rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-semibold text-indigo-300 uppercase tracking-wider">
                <span>🌐 Bilingual Response (Secondary / English)</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopy(suggestion.sample_answer_bilingual!.replace(/\*\*/g, ""))}
                    className="text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer flex items-center gap-1"
                  >
                    <Copy className="w-2.5 h-2.5" /> Copy
                  </button>
                  <button
                    onClick={() => handleAutoPaste(suggestion.sample_answer_bilingual!.replace(/\*\*/g, ""))}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                  >
                    Paste
                  </button>
                </div>
              </div>
              <p className="text-slate-200 italic leading-relaxed select-text">
                "<HighlightText text={suggestion.sample_answer_bilingual} keywords={suggestion.keywords} />"
              </p>
            </div>
          )}
        </div>
      ) : compact ? (
        <div className="py-2 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
          <Bot className="w-4 h-4 text-indigo-400/80" />
          <span>Listening for questions in meeting, or type below:</span>
        </div>
      ) : (
        <div className="py-6 text-center text-slate-400 space-y-2">
          <Bot className="w-8 h-8 text-indigo-400/60 mx-auto" />
          <p className="text-xs">
            Listening for questions in the meeting... When the other party asks a question, real-time talking points,
            keywords, and suggested answers will appear here!
          </p>
        </div>
      )}

      {/* Manual Question Ask Bar */}
      {onAskManual && (
        <form onSubmit={handleManualSubmit} className="mt-3 pt-2.5 border-t border-slate-800 flex items-center gap-1.5">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Ask Copilot for advice or type a question..."
            className="flex-1 bg-slate-950/70 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
          <button
            type="submit"
            disabled={isAsking || !manualInput.trim()}
            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      )}
    </div>
  );
};
