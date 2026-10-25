import React, { useState } from "react";
import { QuestionSuggestion } from "../types";
import { Sparkles, Copy, Check, Send, Bot, HelpCircle, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

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
  const [copied, setCopied] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [isAsking, setIsAsking] = useState(false);

  const handleCopy = () => {
    if (!suggestion) return;
    const textToCopy = `${suggestion.talking_points.map((p) => `• ${p}`).join("\n")}\n\nSuggested: ${suggestion.sample_answer}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAutoPaste = async () => {
    if (!suggestion) return;
    try {
      await invoke("compose_submit", { translatedText: suggestion.sample_answer });
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
      className={`rounded-xl border border-indigo-500/30 bg-slate-900/90 backdrop-blur-md shadow-2xl transition-all ${
        compact ? "p-3 text-xs" : "p-4 text-sm"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-indigo-500/20 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <span className="font-semibold text-indigo-200">AI Meeting Copilot</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            Real-Time Q&A
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {suggestion && (
            <>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-xs"
                title="Copy answer to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={handleAutoPaste}
                className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition text-xs"
                title="Auto-paste into active app (Cmd+V)"
              >
                Auto-Paste
              </button>
            </>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
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
          <div className="flex items-start gap-2 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
            <HelpCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">
                Detected Question
              </div>
              <div className="text-slate-100 font-medium mt-0.5">{suggestion.question_text}</div>
            </div>
          </div>

          {/* Key Talking Points */}
          {suggestion.talking_points.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider mb-1">
                💡 Key Talking Points
              </div>
              <ul className="space-y-1">
                {suggestion.talking_points.map((pt, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-slate-200">
                    <span className="text-indigo-400 font-bold shrink-0">{idx + 1}.</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sample Answer */}
          {suggestion.sample_answer && (
            <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-lg p-2.5">
              <div className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider mb-1">
                💬 Suggested Response
              </div>
              <p className="text-slate-100 italic leading-relaxed">"{suggestion.sample_answer}"</p>
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
            Listening for questions in the meeting... When the other party asks a question, real-time talking points and
            suggested answers will appear here!
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
            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      )}
    </div>
  );
};
