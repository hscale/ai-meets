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
      className={`rounded-2xl border border-white/[0.08] bg-zinc-950/95 backdrop-blur-xl shadow-2xl transition-all ${
        compact ? "p-3 text-xs" : "p-4 text-sm"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-zinc-200">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-xs text-zinc-100 tracking-tight">Meeting Copilot</span>

          {/* Bilingual / Single Mode Switcher */}
          <div className="flex items-center bg-zinc-900 border border-white/[0.06] rounded-md p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setCopilotMode("bilingual")}
              className={`px-2 py-0.5 rounded font-medium transition cursor-pointer flex items-center gap-1 ${
                copilotMode === "bilingual"
                  ? "bg-zinc-800 text-zinc-100 shadow-xs border border-white/[0.08]"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title="Bilingual Mode: Show both Primary and Secondary/English responses & question translation"
            >
              <Globe className="w-2.5 h-2.5" /> Bilingual
            </button>
            <button
              type="button"
              onClick={() => setCopilotMode("single")}
              className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                copilotMode === "single"
                  ? "bg-zinc-800 text-zinc-100 shadow-xs border border-white/[0.08]"
                  : "text-zinc-500 hover:text-zinc-300"
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
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 transition text-[11px] cursor-pointer"
                title="Copy answer to clipboard"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
              <button
                onClick={() => handleAutoPaste()}
                className="px-2.5 py-1 rounded-md bg-white text-zinc-950 hover:bg-zinc-200 font-semibold transition text-[11px] cursor-pointer shadow-xs"
                title="Auto-paste into active app (Cmd+V)"
              >
                Auto-Paste
              </button>
            </>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition cursor-pointer"
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
          <div className="flex items-start gap-2.5 bg-zinc-900/60 p-2.5 rounded-xl border border-white/[0.06]">
            <HelpCircle className="w-4 h-4 text-amber-400/90 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300/80 font-medium">
                  Detected Question
                </div>
                {copilotMode === "bilingual" && (
                  <span className="text-[10px] text-zinc-500 font-mono">Bilingual</span>
                )}
              </div>
              <div className="text-zinc-100 font-medium mt-1 select-text text-xs leading-snug">
                <HighlightText text={suggestion.question_text} keywords={suggestion.keywords} />
              </div>

              {/* Bilingual Question Translation */}
              {copilotMode === "bilingual" && suggestion.question_translation && (
                <div className="mt-1.5 pt-1.5 border-t border-white/[0.06] text-xs text-zinc-300 italic flex items-center gap-1.5 select-text">
                  <span className="text-[9px] uppercase font-mono font-semibold not-italic px-1 py-0.2 rounded bg-white/[0.08] text-zinc-300">
                    Trans
                  </span>
                  <span>{suggestion.question_translation}</span>
                </div>
              )}
            </div>
          </div>

          {/* Keywords Highlight Pills */}
          {suggestion.keywords && suggestion.keywords.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <Tag className="w-2.5 h-2.5 text-zinc-400" /> Keywords:
              </span>
              {suggestion.keywords.map((kw, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md text-[10px] font-mono text-zinc-300 bg-white/[0.04] border border-white/[0.08]"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          {/* Key Talking Points */}
          {suggestion.talking_points.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                Key Talking Points
              </div>
              <ul className="space-y-1">
                {suggestion.talking_points.map((pt, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-zinc-200 select-text text-xs leading-relaxed">
                    <span className="text-zinc-500 font-mono text-[10px] shrink-0 mt-0.5">{idx + 1}.</span>
                    <HighlightText text={pt} keywords={suggestion.keywords} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggested Response (Primary) */}
          {suggestion.sample_answer && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                <span>{copilotMode === "bilingual" ? "Suggested Response (Primary)" : "Suggested Response"}</span>
                {copilotMode === "bilingual" && (
                  <button
                    onClick={() => handleCopy(suggestion.sample_answer.replace(/\*\*/g, ""))}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer flex items-center gap-1"
                  >
                    <Copy className="w-2.5 h-2.5" /> Copy
                  </button>
                )}
              </div>
              <p className="text-zinc-100 italic leading-relaxed select-text text-xs">
                "<HighlightText text={suggestion.sample_answer} keywords={suggestion.keywords} />"
              </p>
            </div>
          )}

          {/* Bilingual Alternative Response */}
          {copilotMode === "bilingual" && suggestion.sample_answer_bilingual && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                <span>Bilingual Response (Secondary / English)</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopy(suggestion.sample_answer_bilingual!.replace(/\*\*/g, ""))}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer flex items-center gap-1"
                  >
                    <Copy className="w-2.5 h-2.5" /> Copy
                  </button>
                  <button
                    onClick={() => handleAutoPaste(suggestion.sample_answer_bilingual!.replace(/\*\*/g, ""))}
                    className="text-[10px] text-white hover:underline font-semibold cursor-pointer"
                  >
                    Paste
                  </button>
                </div>
              </div>
              <p className="text-zinc-300 italic leading-relaxed select-text text-xs">
                "<HighlightText text={suggestion.sample_answer_bilingual} keywords={suggestion.keywords} />"
              </p>
            </div>
          )}
        </div>
      ) : compact ? (
        <div className="py-2 text-center text-zinc-500 flex items-center justify-center gap-2 text-xs">
          <Bot className="w-3.5 h-3.5 text-zinc-400" />
          <span>Listening for questions in meeting, or type below:</span>
        </div>
      ) : (
        <div className="py-6 text-center text-zinc-500 space-y-1.5">
          <Bot className="w-6 h-6 text-zinc-400 mx-auto opacity-60" />
          <p className="text-xs text-zinc-400">
            Listening for questions... Suggested answers and key talking points will appear in real time.
          </p>
        </div>
      )}

      {/* Manual Question Ask Bar */}
      {onAskManual && (
        <form onSubmit={handleManualSubmit} className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center gap-1.5">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Ask Copilot advice or type a question..."
            className="flex-1 bg-zinc-900/80 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-white/30 transition-colors"
          />
          <button
            type="submit"
            disabled={isAsking || !manualInput.trim()}
            className="p-1.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-40 transition-colors shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      )}
    </div>
  );
};
