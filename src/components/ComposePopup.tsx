import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Send, ArrowRight, X, Sparkles } from "lucide-react";

export const ComposePopup: React.FC = () => {
  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [srcLang, setSrcLang] = useState("vi");
  const [tgtLang, setTgtLang] = useState("en");
  const [isTranslating, setIsTranslating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced live translation
  useEffect(() => {
    if (!inputText.trim()) {
      setTranslatedText("");
      return;
    }

    const timer = setTimeout(async () => {
      setIsTranslating(true);
      try {
        const result = await invoke<string>("compose_translate", {
          text: inputText,
          srcLang,
          tgtLang,
        });
        setTranslatedText(result);
      } catch (e) {
        console.error("Compose translation error:", e);
      } finally {
        setIsTranslating(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [inputText, srcLang, tgtLang]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToPaste = translatedText || inputText;
    if (!textToPaste.trim()) return;

    try {
      await invoke("compose_submit", { translatedText: textToPaste });
      setInputText("");
      setTranslatedText("");
    } catch (e) {
      console.error("Auto-paste error:", e);
    }
  };

  const handleClose = async () => {
    await invoke("toggle_compose");
  };

  const handleStartDrag = async (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest("button, select, input, a")) {
      try {
        await getCurrentWindow().startDragging();
      } catch (err) {
        console.warn("Failed to drag compose window:", err);
      }
    }
  };

  return (
    <div className="w-full h-full p-3 flex flex-col justify-center items-center font-sans bg-transparent select-none">
      <div className="w-full max-w-xl bg-slate-900/95 backdrop-blur-2xl border border-indigo-500/40 rounded-2xl shadow-2xl p-4 text-slate-100 flex flex-col gap-3">
        {/* Header & Language Selectors */}
        <div
          onMouseDown={handleStartDrag}
          data-tauri-drag-region="deep"
          className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs cursor-move select-none"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="font-bold text-indigo-300 uppercase tracking-wider">Type & Translate</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={srcLang}
              onChange={(e) => setSrcLang(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none"
            >
              <option value="vi">Vietnamese</option>
              <option value="en">English</option>
              <option value="ja">Japanese</option>
              <option value="zh">Chinese</option>
              <option value="ko">Korean</option>
            </select>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={tgtLang}
              onChange={(e) => setTgtLang(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none"
            >
              <option value="en">English</option>
              <option value="vi">Vietnamese</option>
              <option value="ja">Japanese</option>
              <option value="zh">Chinese</option>
              <option value="ko">Korean</option>
            </select>

            <button onClick={handleClose} className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Input Field */}
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type text to translate and paste automatically (Enter to paste, Esc to cancel)..."
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 pr-10"
            onKeyDown={(e) => {
              if (e.key === "Escape") handleClose();
            }}
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-2 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Live Translation Preview */}
        {translatedText && (
          <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-xl p-2.5 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <div className="text-[10px] uppercase font-bold text-indigo-400">Translation Preview</div>
              <div className="text-slate-100 font-medium">{translatedText}</div>
            </div>
            <button
              onClick={() => handleSubmit()}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shrink-0 transition"
            >
              Paste (Enter)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
