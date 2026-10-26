import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store/useAppStore";
import { AudioVisualizer } from "./AudioVisualizer";
import { CopilotCard } from "./CopilotCard";
import { ProviderTestResult, TranslationConfig } from "../types";
import {
  Mic,
  MicOff,
  Sparkles,
  BookA,
  FileText,
  Settings,
  History,
  Download,
  Trash2,
  Plus,
  Play,
  CheckCircle,
  Layers,
  Save,
  Radio,
  Eye,
  Lock,
  Unlock,
  Zap,
  AlertCircle,
  BarChart2,
  Pencil,
  Copy,
  Check,
  X,
  Globe,
  Cpu,
} from "lucide-react";

export const Dashboard: React.FC = () => {
  const {
    status,
    audioSources,
    selectedAudioSource,
    setSelectedAudioSource,
    srcLang,
    tgtLang,
    setLanguages,
    subtitles,
    latestSuggestion,
    profiles,
    activeProfile,
    glossary,
    sessions,
    settings,
    audioLevel,
    overlayLocked,
    overlayVisible,
    startSession,
    stopSession,
    simulateSpeech,
    askCopilotManual,
    setOverlayVisible,
    toggleOverlayVisible,
    setOverlayLocked,
    copilotVisible,
    copilotLocked,
    isCopilotSplit,
    toggleCopilotVisible,
    setCopilotLocked,
    setCopilotSplit,
    toggleCopilotSplit,
    saveProfile,
    setActiveProfile,
    deleteProfile,
    addGlossaryEntry,
    deleteGlossaryEntry,
    loadHistory,
    deleteSession,
    clearHistory,
    exportTranscript,
    saveSettings,
    transcriptionMode,
    setTranscriptionMode,
    copilotMode,
    setCopilotMode,
    fontSize,
    setFontSize,
    updateSubtitle,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<"live" | "profiles" | "glossary" | "history" | "settings">("live");
  const [sessionTitle, setSessionTitle] = useState("");
  const [testSpeechText, setTestSpeechText] = useState("");
  const [testSpeaker, setTestSpeaker] = useState("Interviewer");

  // Live Transcript Editing & Copy state
  const [editingSubtitleId, setEditingSubtitleId] = useState<string | null>(null);
  const [editSubSrcText, setEditSubSrcText] = useState("");
  const [editSubTgtText, setEditSubTgtText] = useState("");
  const [copiedSubtitleId, setCopiedSubtitleId] = useState<string | null>(null);

  const handleCopySubtitle = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSubtitleId(id);
    setTimeout(() => setCopiedSubtitleId(null), 2000);
  };

  const handleStartEditSubtitle = (sub: (typeof subtitles)[0]) => {
    setEditingSubtitleId(sub.id);
    setEditSubSrcText(sub.src_text);
    setEditSubTgtText(sub.tgt_text);
  };

  const handleSaveEditSubtitle = async (id: string) => {
    if (editSubTgtText.trim()) {
      await updateSubtitle(id, editSubSrcText.trim(), editSubTgtText.trim());
    }
    setEditingSubtitleId(null);
  };

  const handleCancelEditSubtitle = () => {
    setEditingSubtitleId(null);
  };

  // Profile Form state
  const [profileName, setProfileName] = useState("");
  const [profileType, setProfileType] = useState<"interview" | "sales" | "meeting" | "custom">("interview");
  const [profileContent, setProfileContent] = useState("");

  // Glossary Form state
  const [glossarySource, setGlossarySource] = useState("");
  const [glossaryTarget, setGlossaryTarget] = useState("");

  // Settings Form state
  const [provider, setProvider] = useState(settings.provider);
  const [localEndpoint, setLocalEndpoint] = useState(settings.local_endpoint);
  const [openaiKey, setOpenaiKey] = useState(settings.openai_api_key || "");
  const [anthropicKey, setAnthropicKey] = useState(settings.anthropic_api_key || "");
  const [geminiKey, setGeminiKey] = useState(settings.gemini_api_key || "");
  const [modelName, setModelName] = useState(settings.model_name);
  const [customEndpoint, setCustomEndpoint] = useState(settings.custom_endpoint || "https://api.deepseek.com/v1");
  const [customApiKey, setCustomApiKey] = useState(settings.custom_api_key || "");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Synchronize settings from store when loaded asynchronously from SQLite
  useEffect(() => {
    if (settings) {
      setProvider(settings.provider || "local");
      setLocalEndpoint(settings.local_endpoint || "http://127.0.0.1:8080/v1");
      setOpenaiKey(settings.openai_api_key || "");
      setAnthropicKey(settings.anthropic_api_key || "");
      setGeminiKey(settings.gemini_api_key || "");
      setModelName(settings.model_name || "hy-mt2-1.8b");
      setCustomEndpoint(settings.custom_endpoint || "https://api.deepseek.com/v1");
      setCustomApiKey(settings.custom_api_key || "");
    }
  }, [settings]);

  // Test & Benchmark Provider state
  const [testingProvider, setTestingProvider] = useState(false);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);

  // Compare All Providers state
  const [comparing, setComparing] = useState(false);
  const [compareResults, setCompareResults] = useState<ProviderTestResult[]>([]);

  const openAICompatiblePresets = [
    { name: "DeepSeek", endpoint: "https://api.deepseek.com/v1", model: "deepseek-chat" },
    { name: "Groq", endpoint: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
    { name: "OpenRouter", endpoint: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3.3-70b-instruct" },
    { name: "Together AI", endpoint: "https://api.together.xyz/v1", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
    { name: "Mistral", endpoint: "https://api.mistral.ai/v1", model: "mistral-small-latest" },
    { name: "SiliconFlow", endpoint: "https://api.siliconflow.cn/v1", model: "deepseek-ai/DeepSeek-V3" },
    { name: "Local vLLM / Ollama", endpoint: "http://localhost:11434/v1", model: "qwen2.5:7b" },
  ];

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleStartStop = async () => {
    if (status.is_recording) {
      await stopSession();
    } else {
      await startSession(sessionTitle || "Real-Time Meeting");
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testSpeechText.trim()) return;
    await simulateSpeech(testSpeaker, testSpeechText);
    setTestSpeechText("");
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim() || !profileContent.trim()) return;
    await saveProfile({
      id: crypto.randomUUID(),
      name: profileName,
      profile_type: profileType,
      content: profileContent,
      is_active: profiles.length === 0,
      updated_at: new Date().toISOString(),
    });
    setProfileName("");
    setProfileContent("");
  };

  const handleAddGlossary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!glossarySource.trim() || !glossaryTarget.trim()) return;
    await addGlossaryEntry(glossarySource, glossaryTarget);
    setGlossarySource("");
    setGlossaryTarget("");
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettings({
      provider,
      local_endpoint: localEndpoint,
      openai_api_key: openaiKey || undefined,
      anthropic_api_key: anthropicKey || undefined,
      gemini_api_key: geminiKey || undefined,
      model_name: modelName,
      custom_endpoint: customEndpoint,
      custom_api_key: customApiKey || undefined,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  const handleTestProvider = async () => {
    setTestingProvider(true);
    setTestResult(null);
    try {
      const cfg: TranslationConfig = {
        provider,
        local_endpoint: localEndpoint,
        openai_api_key: openaiKey || undefined,
        anthropic_api_key: anthropicKey || undefined,
        gemini_api_key: geminiKey || undefined,
        model_name: modelName,
        custom_endpoint: customEndpoint,
        custom_api_key: customApiKey || undefined,
      };
      const result = await invoke<ProviderTestResult>("test_provider", {
        clientConfig: cfg,
        sampleText: "Welcome everyone to our project architecture review meeting.",
        srcLang: "en",
        tgtLang: "vi",
      });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        provider,
        model: modelName,
        latency_ms: 0,
        translation: "",
        success: false,
        error: String(err),
      });
    } finally {
      setTestingProvider(false);
    }
  };

  const handleCompareAllProviders = async () => {
    setComparing(true);
    setCompareResults([]);
    const testList: TranslationConfig[] = [];

    // Local
    testList.push({
      provider: "local",
      local_endpoint: localEndpoint,
      model_name: "hy-mt2-1.8b",
    });

    // OpenAI Compatible
    if (customEndpoint) {
      testList.push({
        provider: "openai_compatible",
        local_endpoint: localEndpoint,
        custom_endpoint: customEndpoint,
        custom_api_key: customApiKey || undefined,
        model_name: modelName || "deepseek-chat",
      });
    }

    // OpenAI official
    if (openaiKey) {
      testList.push({
        provider: "openai",
        local_endpoint: localEndpoint,
        openai_api_key: openaiKey,
        model_name: "gpt-4o-mini",
      });
    }

    // Anthropic
    if (anthropicKey) {
      testList.push({
        provider: "anthropic",
        local_endpoint: localEndpoint,
        anthropic_api_key: anthropicKey,
        model_name: "claude-3-haiku-20240307",
      });
    }

    // Gemini
    if (geminiKey) {
      testList.push({
        provider: "gemini",
        local_endpoint: localEndpoint,
        gemini_api_key: geminiKey,
        model_name: "gemini-2.0-flash",
      });
    }

    const results: ProviderTestResult[] = [];
    for (const cfg of testList) {
      try {
        const res = await invoke<ProviderTestResult>("test_provider", {
          clientConfig: cfg,
          sampleText: "Welcome everyone to our project architecture review meeting.",
          srcLang: "en",
          tgtLang: "vi",
        });
        results.push(res);
      } catch (e: any) {
        results.push({
          provider: cfg.provider,
          model: cfg.model_name,
          latency_ms: 0,
          translation: "",
          success: false,
          error: String(e),
        });
      }
    }
    setCompareResults(results);
    setComparing(false);
  };

  const handleExport = async (sessionId: string, format: "srt" | "md" | "csv") => {
    try {
      const data = await exportTranscript(sessionId, format);
      const blob = new Blob([data], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meeting_${sessionId.slice(0, 8)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export error:", e);
    }
  };

  return (
    <div className="flex h-screen bg-[#0B0C10] text-zinc-100 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <div className="w-60 border-r border-white/[0.06] bg-zinc-950/70 p-4 flex flex-col justify-between shrink-0 backdrop-blur-xl">
        <div className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white">
                <Radio className="w-3.5 h-3.5 text-zinc-200" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-zinc-100 tracking-tight">AI Meets</span>
                <span className="text-[10px] font-mono text-zinc-400 bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 rounded">v0.2</span>
              </div>
            </div>
          </div>

          {/* Primary Meeting Control in Sidebar */}
          <div className="bg-zinc-900/60 border border-white/[0.08] rounded-xl p-3 space-y-2.5">
            <button
              type="button"
              onClick={handleStartStop}
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium text-xs transition cursor-pointer ${
                status.is_recording
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
                  : "bg-white hover:bg-zinc-200 text-zinc-950 font-semibold shadow-xs"
              }`}
            >
              {status.is_recording ? (
                <>
                  <MicOff className="w-3.5 h-3.5 text-rose-400" />
                  <span>Stop Recording</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-zinc-950" />
                  <span>Start Meeting</span>
                </>
              )}
            </button>
            <div className="flex items-center justify-between text-[11px] text-zinc-400 px-0.5 font-mono">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    status.is_recording ? "bg-rose-500 animate-pulse" : "bg-emerald-400"
                  }`}
                />
                <span className="text-zinc-300 font-sans text-[11px]">
                  {status.is_recording ? "Live Session" : "Engine Ready"}
                </span>
              </span>
              <span className="text-zinc-400">
                {srcLang.toUpperCase()} → {tgtLang.toUpperCase()}
              </span>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("live")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === "live"
                  ? "bg-white/[0.08] text-white border border-white/[0.08]"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Live Meeting & Subtitles
            </button>

            <button
              onClick={() => setActiveTab("profiles")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === "profiles"
                  ? "bg-white/[0.08] text-white border border-white/[0.08]"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Knowledge Profiles (CV/FAQ)
            </button>

            <button
              onClick={() => setActiveTab("glossary")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === "glossary"
                  ? "bg-white/[0.08] text-white border border-white/[0.08]"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
              }`}
            >
              <BookA className="w-3.5 h-3.5" />
              Custom Glossary
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === "history"
                  ? "bg-white/[0.08] text-white border border-white/[0.08]"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Meeting History & Export
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === "settings"
                  ? "bg-white/[0.08] text-white border border-white/[0.08]"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              AI Models & Settings
            </button>
          </nav>
        </div>

        {/* Bottom Status Panel */}
        <div className="bg-zinc-900/60 border border-white/[0.08] rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Audio In:</span>
            <AudioVisualizer level={audioLevel} active={status.is_recording} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Profile:</span>
            <span className="font-medium text-zinc-300 truncate max-w-[120px]">
              {activeProfile ? activeProfile.name : "None"}
            </span>
          </div>

          {/* Split / Dock Mode Selector */}
          <div className="pt-1 border-t border-white/[0.06]">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
              <span>HUD Layout:</span>
              <span className="font-mono text-zinc-300 text-[10px]">
                {isCopilotSplit ? "Split" : "Docked"}
              </span>
            </div>
            <div className="flex bg-zinc-950/80 rounded-lg p-0.5 border border-white/[0.08] text-[10px]">
              <button
                type="button"
                onClick={() => setCopilotSplit(true)}
                className={`flex-1 py-1 rounded font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                  isCopilotSplit
                    ? "bg-white/10 text-white shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="Split Subtitles & AI Copilot into 2 independent movable boxes"
              >
                <Layers className="w-3 h-3" /> Split (2)
              </button>
              <button
                type="button"
                onClick={() => setCopilotSplit(false)}
                className={`flex-1 py-1 rounded font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                  !isCopilotSplit
                    ? "bg-white/10 text-white shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="Dock Subtitles & AI Copilot together into 1 box"
              >
                Docked (1)
              </button>
            </div>
          </div>

          {/* Subtitles HUD Toggle */}
          <div className="pt-0.5 flex gap-1.5">
            <button
              onClick={toggleOverlayVisible}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                overlayVisible
                  ? "bg-white/15 text-white border border-white/20"
                  : "bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/[0.06]"
              }`}
              title="Toggle Live Subtitles HUD"
            >
              <Eye className="w-3 h-3" /> Subtitles
            </button>
            <button
              onClick={() => setOverlayLocked(!overlayLocked)}
              className={`px-2 py-1 rounded-lg text-[11px] transition cursor-pointer ${
                overlayLocked
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 border border-white/[0.06]"
              }`}
              title={overlayLocked ? "Subtitles click-through is locked" : "Lock click-through for Subtitles"}
            >
              {overlayLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            </button>
          </div>

          {/* AI Copilot HUD Toggle */}
          <div className="flex gap-1.5">
            <button
              onClick={toggleCopilotVisible}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                copilotVisible
                  ? "bg-white/15 text-white border border-white/20"
                  : "bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/[0.06]"
              }`}
              title="Toggle AI Copilot HUD Window"
            >
              <Sparkles className="w-3 h-3" /> Copilot HUD
            </button>
            <button
              onClick={() => setCopilotLocked(!copilotLocked)}
              className={`px-2 py-1 rounded-lg text-[11px] transition cursor-pointer ${
                copilotLocked
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 border border-white/[0.06]"
              }`}
              title={copilotLocked ? "Copilot click-through is locked" : "Lock click-through for Copilot"}
            >
              {copilotLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-auto bg-[#0B0C10]">
        {/* Top Control Bar */}
        <header className="h-14 border-b border-white/[0.08] bg-zinc-950/80 backdrop-blur-md px-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <input
              type="text"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="Meeting / Interview Title..."
              disabled={status.is_recording}
              className="bg-zinc-900/90 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-white/25 w-44 sm:w-56 shrink-0"
            />

            {/* Audio Source Picker */}
            <select
              value={selectedAudioSource}
              onChange={(e) => setSelectedAudioSource(e.target.value)}
              disabled={status.is_recording}
              className="bg-zinc-900/90 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none max-w-[160px] truncate shrink-0 cursor-pointer"
            >
              {audioSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Languages */}
            <div className="flex items-center bg-zinc-900/90 border border-white/[0.08] rounded-lg px-1.5 py-0.5 text-xs text-zinc-300 shrink-0">
              <select
                value={srcLang}
                onChange={(e) => setLanguages(e.target.value, tgtLang)}
                disabled={status.is_recording}
                className="bg-transparent text-xs text-zinc-200 focus:outline-none py-1 px-1 cursor-pointer"
              >
                <option value="en">EN</option>
                <option value="vi">VI</option>
                <option value="ja">JA</option>
                <option value="zh">ZH</option>
                <option value="ko">KO</option>
                <option value="fr">FR</option>
                <option value="de">DE</option>
                <option value="es">ES</option>
              </select>
              <span className="text-zinc-500 text-[10px] px-1 font-mono">→</span>
              <select
                value={tgtLang}
                onChange={(e) => setLanguages(srcLang, e.target.value)}
                disabled={status.is_recording}
                className="bg-transparent text-xs text-zinc-200 focus:outline-none py-1 px-1 cursor-pointer"
              >
                <option value="vi">VI</option>
                <option value="en">EN</option>
                <option value="ja">JA</option>
                <option value="zh">ZH</option>
                <option value="ko">KO</option>
                <option value="fr">FR</option>
                <option value="de">DE</option>
                <option value="es">ES</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartStop}
            className={`shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs ${
              status.is_recording
                ? "bg-rose-500/20 text-rose-200 border border-rose-500/40 hover:bg-rose-500/30"
                : "bg-white hover:bg-zinc-200 text-zinc-950 font-semibold"
            }`}
            title={status.is_recording ? "Click to stop recording session" : "Click to start real-time meeting transcription"}
          >
            {status.is_recording ? (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span>Stop Meeting</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 text-zinc-950" />
                <span>Start Meeting</span>
              </>
            )}
          </button>
        </header>

        {/* Tab 1: Live Meeting & Subtitles */}
        {activeTab === "live" && (
          <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-5 flex-1 min-h-0 overflow-auto">
            {/* Live Subtitles Log (3 cols / 60%) */}
            <div className="md:col-span-3 flex flex-col gap-3 min-h-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <h2 className="text-sm font-semibold text-zinc-100">Live Dialogue</h2>

                  {/* Translation Mode Toggle */}
                  <div className="flex items-center bg-zinc-900/80 rounded-lg p-0.5 border border-white/[0.08] text-[11px]">
                    <button
                      type="button"
                      onClick={() => setTranscriptionMode("bilingual")}
                      className={`px-2 py-0.5 rounded font-medium transition cursor-pointer flex items-center gap-1 ${
                        transcriptionMode === "bilingual"
                          ? "bg-white/10 text-white shadow-xs"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                      title="Show both translated text and original spoken speech"
                    >
                      <Globe className="w-3 h-3" /> Bilingual
                    </button>
                    <button
                      type="button"
                      onClick={() => setTranscriptionMode("single")}
                      className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                        transcriptionMode === "single"
                          ? "bg-white/10 text-white shadow-xs"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                      title="Show translated subtitles only"
                    >
                      Single
                    </button>
                  </div>
                </div>

                <span className="text-xs text-zinc-400 font-mono">
                  {subtitles.length} {subtitles.length === 1 ? "turn" : "turns"}
                </span>
              </div>

              {/* Subtitles Box */}
              <div className="flex-1 min-h-[300px] bg-zinc-900/30 border border-white/[0.08] rounded-xl p-3.5 overflow-y-auto space-y-2.5 select-text cursor-text">
                {subtitles.length > 0 ? (
                  subtitles.map((sub) => {
                    const isEditing = editingSubtitleId === sub.id;

                    if (isEditing) {
                      return (
                        <div
                          key={sub.id}
                          className="p-3 rounded-lg bg-zinc-900 border border-white/20 space-y-2 shadow-lg select-auto"
                        >
                          <div className="flex items-center justify-between text-xs text-zinc-300 font-medium">
                            <span>Editing Utterance ({sub.speaker}):</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveEditSubtitle(sub.id)}
                                className="px-2 py-0.5 rounded bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                              >
                                <Check className="w-3 h-3" /> Save
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditSubtitle}
                                className="p-1 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 uppercase font-mono">
                              Translated Text
                            </label>
                            <input
                              type="text"
                              value={editSubTgtText}
                              onChange={(e) => setEditSubTgtText(e.target.value)}
                              className="w-full bg-zinc-950 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-white/30 mt-0.5"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 uppercase font-mono">
                              Original Spoken Text
                            </label>
                            <input
                              type="text"
                              value={editSubSrcText}
                              onChange={(e) => setEditSubSrcText(e.target.value)}
                              className="w-full bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-zinc-300 italic focus:outline-none focus:border-white/30 mt-0.5"
                            />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={sub.id}
                        className={`p-3 rounded-lg border transition group/item select-text ${
                          sub.is_question
                            ? "bg-amber-500/[0.04] border-amber-500/25"
                            : "bg-zinc-900/50 border-white/[0.06] hover:border-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono text-[10px] uppercase ${
                                sub.speaker === "Me"
                                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                  : "bg-sky-500/10 text-sky-300 border border-sky-500/20"
                              }`}
                            >
                              {sub.speaker}
                            </span>
                            {sub.is_question && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                Question
                              </span>
                            )}
                            {sub.is_edited && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-white/[0.06] border border-white/[0.08]">
                                Edited
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {new Date(sub.timestamp_ms).toLocaleTimeString()}
                            </span>

                            {/* Copy & Edit Buttons */}
                            <div className="flex items-center gap-1 opacity-70 group-hover/item:opacity-100 transition">
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
                                className="p-1 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                                title="Copy utterance"
                              >
                                {copiedSubtitleId === sub.id ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEditSubtitle(sub)}
                                className="p-1 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                                title="Edit utterance text"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Primary Translated Text */}
                        <div className="text-sm font-medium text-zinc-100 select-text leading-relaxed">
                          {sub.tgt_text}
                        </div>

                        {/* Secondary Spoken Text (Bilingual Mode) */}
                        {transcriptionMode === "bilingual" && (
                          <div className="text-xs text-zinc-400 italic mt-1 select-text">
                            {sub.src_text}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-3 py-16 px-4">
                    <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-400">
                      <Mic className="w-5 h-5 text-zinc-300" />
                    </div>
                    <div className="text-center max-w-sm space-y-1">
                      <h3 className="text-sm font-semibold text-zinc-100">Ready for Live Dialogue</h3>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Click Start Meeting or use the simulator below to begin real-time speech translation and copilot insights.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono pt-1">
                      <span>{srcLang.toUpperCase()} → {tgtLang.toUpperCase()}</span>
                      <span>•</span>
                      <span>Device: {audioSources.find((s) => s.id === selectedAudioSource)?.name || "System Default"}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Speech Simulator / Tester */}
              <form onSubmit={handleSimulate} className="bg-zinc-900/40 border border-white/[0.08] rounded-xl p-2.5 flex items-center gap-2">
                <select
                  value={testSpeaker}
                  onChange={(e) => setTestSpeaker(e.target.value)}
                  className="bg-zinc-950 border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none"
                >
                  <option value="Interviewer">Interviewer</option>
                  <option value="Client">Client</option>
                  <option value="Colleague">Colleague</option>
                  <option value="Me">Me</option>
                </select>

                <input
                  type="text"
                  value={testSpeechText}
                  onChange={(e) => setTestSpeechText(e.target.value)}
                  placeholder="Test speech e.g.: 'How do you handle microservices database migrations?'"
                  className="flex-1 bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-white/20"
                />

                <button
                  type="submit"
                  disabled={!testSpeechText.trim()}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-zinc-200 border border-white/10 font-medium text-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                >
                  <Play className="w-3 h-3" /> Simulate
                </button>
              </form>
            </div>

            {/* AI Copilot Answer Suggestion Column (2 cols / 40%) */}
            <div className="md:col-span-2 flex flex-col gap-3 min-h-0">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
                  AI Answer Copilot
                </h2>
              </div>
              <CopilotCard suggestion={latestSuggestion} onAskManual={askCopilotManual} />
            </div>
          </div>
        )}

        {/* Tab 2: Knowledge Profiles */}
        {activeTab === "profiles" && (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 flex-1 overflow-auto">
            {/* Create Profile */}
            <form onSubmit={handleCreateProfile} className="bg-zinc-900/40 border border-white/[0.08] rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-zinc-300" />
                  Add Context / Knowledge Profile
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Ground the AI answer suggestions with your resume (for technical interviews), product battlecards (for sales), or meeting agendas!
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Profile Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g., Senior Full-Stack Engineer CV 2026"
                  className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-white/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Profile Type</label>
                <select
                  value={profileType}
                  onChange={(e) => setProfileType(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                >
                  <option value="interview">Job Interview (CV, Experience, Tech Stack)</option>
                  <option value="sales">Sales & Demo (Product FAQs, Pricing, Competitors)</option>
                  <option value="meeting">Business Meeting (Agenda, Specifications)</option>
                  <option value="custom">Custom Knowledge Base</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Knowledge Base Content (Paste Markdown or Plain Text)
                </label>
                <textarea
                  rows={9}
                  value={profileContent}
                  onChange={(e) => setProfileContent(e.target.value)}
                  placeholder="Paste your CV, project achievements, technical strengths, product specifications, or interview preparation notes here..."
                  className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg p-3 text-xs text-zinc-100 focus:outline-none focus:border-white/20 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={!profileName.trim() || !profileContent.trim()}
                className="w-full py-2 bg-white hover:bg-zinc-200 disabled:opacity-40 text-zinc-950 font-semibold text-xs rounded-lg transition cursor-pointer"
              >
                Save Knowledge Profile
              </button>
            </form>

            {/* Existing Profiles List */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-zinc-300" />
                Saved Profiles ({profiles.length})
              </h2>

              <div className="space-y-2.5">
                {profiles.map((p) => (
                  <div
                    key={p.id}
                    className={`p-4 rounded-xl border transition ${
                      p.is_active
                        ? "bg-zinc-900/80 border-emerald-500/40 shadow-sm"
                        : "bg-zinc-900/40 border-white/[0.06] hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-100">{p.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-800 text-zinc-300">
                          {p.profile_type}
                        </span>
                        {p.is_active && (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle className="w-3 h-3" /> Active Profile
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!p.is_active && (
                          <button
                            onClick={() => setActiveProfile(p.id)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-200 border border-white/10 transition cursor-pointer"
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          onClick={() => deleteProfile(p.id)}
                          className="p-1 text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                          title="Delete profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-400 line-clamp-3 font-mono bg-zinc-950/60 p-2.5 rounded-lg border border-white/[0.06]">
                      {p.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Custom Glossary */}
        {activeTab === "glossary" && (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 flex-1 overflow-auto">
            {/* Add Glossary Term */}
            <form onSubmit={handleAddGlossary} className="bg-zinc-900/40 border border-white/[0.08] rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-zinc-300" />
                  Add Glossary Term
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Ensure technical jargon, brand names, or specific acronyms translate exactly as specified!
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Source Term</label>
                <input
                  type="text"
                  value={glossarySource}
                  onChange={(e) => setGlossarySource(e.target.value)}
                  placeholder="e.g., Kubernetes Pod"
                  className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-white/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Target Translation</label>
                <input
                  type="text"
                  value={glossaryTarget}
                  onChange={(e) => setGlossaryTarget(e.target.value)}
                  placeholder="e.g., Cụm Kubernetes Pod"
                  className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-white/20"
                />
              </div>

              <button
                type="submit"
                disabled={!glossarySource.trim() || !glossaryTarget.trim()}
                className="w-full py-2 bg-white hover:bg-zinc-200 disabled:opacity-40 text-zinc-950 font-semibold text-xs rounded-lg transition cursor-pointer"
              >
                Add Term to Dictionary
              </button>
            </form>

            {/* Glossary Table */}
            <div className="bg-zinc-900/40 border border-white/[0.08] rounded-xl p-5 flex flex-col space-y-3">
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <BookA className="w-4 h-4 text-zinc-300" />
                Custom Terminology Mappings ({glossary.length})
              </h2>

              <div className="flex-1 overflow-y-auto space-y-2 max-h-[460px]">
                {glossary.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-white/[0.06] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-100">{g.source}</span>
                      <span className="text-zinc-500 font-mono">→</span>
                      <span className="font-medium text-emerald-400">{g.target}</span>
                    </div>

                    <button
                      onClick={() => deleteGlossaryEntry(g.id)}
                      className="text-zinc-500 hover:text-rose-400 p-1 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Meeting History & Export */}
        {activeTab === "history" && (
          <div className="p-5 space-y-4 flex-1 overflow-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <History className="w-4 h-4 text-zinc-300" />
                Meeting Sessions ({sessions.length})
              </h2>

              {sessions.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All History
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {sessions.map((s) => (
                <div key={s.id} className="bg-zinc-900/40 border border-white/[0.08] rounded-xl p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-100">{s.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono uppercase">
                        {s.src_lang} → {s.tgt_lang}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 font-mono">
                      Started: {new Date(s.started_at).toLocaleString()} | Source: {s.audio_source}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExport(s.id, "srt")}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs text-zinc-300 border border-white/[0.08] transition cursor-pointer"
                      title="Export SubRip Subtitles"
                    >
                      <Download className="w-3.5 h-3.5" /> .SRT
                    </button>
                    <button
                      onClick={() => handleExport(s.id, "md")}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs text-zinc-300 border border-white/[0.08] transition cursor-pointer"
                      title="Export Markdown Transcript"
                    >
                      <Download className="w-3.5 h-3.5" /> .MD
                    </button>
                    <button
                      onClick={() => handleExport(s.id, "csv")}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs text-zinc-300 border border-white/[0.08] transition cursor-pointer"
                      title="Export CSV data"
                    >
                      <Download className="w-3.5 h-3.5" /> .CSV
                    </button>
                    <button
                      onClick={() => deleteSession(s.id)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 5: AI Models & Settings */}
        {activeTab === "settings" && (
          <form onSubmit={handleSaveSettings} className="p-5 max-w-2xl space-y-5 flex-1 overflow-auto">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Settings className="w-4 h-4 text-zinc-300" />
                Settings & Preferences
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Configure your meeting language pairs, audio devices, overlay preferences, and hybrid AI models. All preferences persist across sessions in local SQLite.
              </p>
            </div>

            {/* Section 1: Meeting & Language Preferences */}
            <div className="bg-zinc-900/40 border border-white/[0.08] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-zinc-400" />
                    Meeting & Language Preferences
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Default languages, audio source, subtitle modes, and window layouts.
                  </p>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-mono">
                  Auto-persisted
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Spoken Meeting Language (Source)
                  </label>
                  <select
                    value={srcLang}
                    onChange={(e) => setLanguages(e.target.value, tgtLang)}
                    disabled={status.is_recording}
                    className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                  >
                    <option value="en">English (US/UK)</option>
                    <option value="vi">Vietnamese (Tiếng Việt)</option>
                    <option value="ja">Japanese (日本語)</option>
                    <option value="zh">Chinese (中文)</option>
                    <option value="ko">Korean (한국어)</option>
                    <option value="fr">French (Français)</option>
                    <option value="de">German (Deutsch)</option>
                    <option value="es">Spanish (Español)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Subtitles & Copilot Translation (Target)
                  </label>
                  <select
                    value={tgtLang}
                    onChange={(e) => setLanguages(srcLang, e.target.value)}
                    disabled={status.is_recording}
                    className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                  >
                    <option value="vi">Vietnamese (Tiếng Việt)</option>
                    <option value="en">English (US/UK)</option>
                    <option value="ja">Japanese (日本語)</option>
                    <option value="zh">Chinese (中文)</option>
                    <option value="ko">Korean (한국어)</option>
                    <option value="fr">French (Français)</option>
                    <option value="de">German (Deutsch)</option>
                    <option value="es">Spanish (Español)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Default Audio Input Device
                </label>
                <select
                  value={selectedAudioSource}
                  onChange={(e) => setSelectedAudioSource(e.target.value)}
                  disabled={status.is_recording}
                  className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                >
                  {audioSources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.is_default ? "(System Default)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1 border-t border-white/[0.06]">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Live Subtitles Mode
                  </label>
                  <select
                    value={transcriptionMode}
                    onChange={(e) => setTranscriptionMode(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="bilingual">Bilingual (Both)</option>
                    <option value="single">Single (Trans only)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    AI Copilot Output Mode
                  </label>
                  <select
                    value={copilotMode}
                    onChange={(e) => setCopilotMode(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="bilingual">Bilingual Answers</option>
                    <option value="single">Single Language</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    HUD Box Layout
                  </label>
                  <select
                    value={isCopilotSplit ? "split" : "docked"}
                    onChange={(e) => setCopilotSplit(e.target.value === "split")}
                    className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="split">Split (2 Boxes)</option>
                    <option value="docked">Docked (1 Box)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: AI Model & Provider Configuration */}
            <div className="space-y-4 bg-zinc-900/40 border border-white/[0.08] rounded-xl p-5">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-zinc-400" />
                    AI Model & Provider Configuration
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Configure your hybrid inference backend (Local, OpenAI, OpenAI-Compatible, Claude, Gemini).
                  </p>
                </div>
                {saveSuccess && (
                  <span className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-medium flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" /> Saved & Active!
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Active AI Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                >
                  <option value="local">Local llama-server / Ollama (100% Privacy & Zero Cost)</option>
                  <option value="openai_compatible">OpenAI API Compatible (DeepSeek, Groq, OpenRouter, etc.)</option>
                  <option value="openai">OpenAI (GPT-4o-mini / GPT-4o)</option>
                  <option value="anthropic">Anthropic Claude (Claude 3.5 Sonnet / Haiku)</option>
                  <option value="gemini">Google Gemini (Gemini 2.0 Flash / 1.5 Pro)</option>
                </select>
              </div>

              {provider === "openai_compatible" && (
                <div className="space-y-3 bg-zinc-950/60 p-3.5 rounded-lg border border-white/[0.06]">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      API Base URL / Endpoint
                    </label>
                    <input
                      type="text"
                      value={customEndpoint}
                      onChange={(e) => setCustomEndpoint(e.target.value)}
                      placeholder="https://api.deepseek.com/v1"
                      className="w-full bg-zinc-900 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Quick Provider Presets
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {openAICompatiblePresets.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            setCustomEndpoint(preset.endpoint);
                            setModelName(preset.model);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                            customEndpoint === preset.endpoint
                              ? "bg-white/15 text-white border-white/20"
                              : "bg-zinc-900 text-zinc-400 border-white/[0.06] hover:border-white/10 hover:text-zinc-200"
                          }`}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Custom API Key (Bearer Token)
                    </label>
                    <input
                      type="password"
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      placeholder="sk-... (Leave empty for local endpoints)"
                      className="w-full bg-zinc-900 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              )}

              {provider === "local" && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Local HTTP Endpoint</label>
                  <input
                    type="text"
                    value={localEndpoint}
                    onChange={(e) => setLocalEndpoint(e.target.value)}
                    placeholder="http://127.0.0.1:8080/v1"
                    className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none font-mono"
                  />
                </div>
              )}

              {provider === "openai" && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">OpenAI API Key</label>
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none font-mono"
                  />
                </div>
              )}

              {provider === "anthropic" && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Anthropic API Key</label>
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none font-mono"
                  />
                </div>
              )}

              {provider === "gemini" && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Google Gemini API Key</label>
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Model Name / Identifier</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="hy-mt2-1.8b or gpt-4o-mini or claude-3-haiku-20240307"
                  className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none font-mono"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestProvider}
                  disabled={testingProvider}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 text-zinc-200 font-medium text-xs rounded-lg border border-white/[0.08] transition cursor-pointer"
                >
                  <Zap className={`w-3.5 h-3.5 text-amber-400 ${testingProvider ? "animate-spin" : ""}`} />
                  {testingProvider ? "Benchmarking..." : "Test Active Provider"}
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs rounded-lg transition shadow-xs cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Configuration
                </button>
              </div>

              {/* Active Provider Test Result */}
              {testResult && (
                <div
                  className={`p-3.5 rounded-lg border text-xs transition ${
                    testResult.success
                      ? "bg-zinc-950/80 border-emerald-500/30 text-zinc-200"
                      : "bg-rose-950/20 border-rose-500/30 text-rose-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold flex items-center gap-1.5">
                      {testResult.success ? (
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      {testResult.provider} ({testResult.model})
                    </span>
                    {testResult.success && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                          testResult.latency_ms < 500
                            ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                            : testResult.latency_ms < 1500
                            ? "bg-sky-500/10 text-sky-300 border border-sky-500/20"
                            : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                        }`}
                      >
                        ⚡ {testResult.latency_ms} ms
                      </span>
                    )}
                  </div>
                  {testResult.success ? (
                    <div className="space-y-1">
                      <div className="text-[11px] text-zinc-400">
                        Input: <span className="italic">"Welcome everyone to our project architecture review meeting."</span>
                      </div>
                      <div className="text-[11px] text-emerald-300 font-medium bg-emerald-500/[0.06] p-2 rounded-lg border border-emerald-500/20">
                        {testResult.translation}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-rose-300 mt-1">
                      Error: {testResult.error || "Inference failed"}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Provider Comparison & Benchmark Card */}
            <div className="bg-zinc-900/40 border border-white/[0.08] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <BarChart2 className="w-4 h-4 text-zinc-400" />
                    Multi-Provider Comparison & Benchmark
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Evaluate latency and translation fidelity side-by-side across all configured AI backends.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCompareAllProviders}
                  disabled={comparing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-zinc-200 border border-white/10 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  <BarChart2 className={`w-3.5 h-3.5 ${comparing ? "animate-pulse" : ""}`} />
                  {comparing ? "Benchmarking All..." : "Compare Providers"}
                </button>
              </div>

              {compareResults.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] text-zinc-400 font-medium">
                    Benchmark Results ({compareResults.length} backends evaluated):
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {compareResults
                      .slice()
                      .sort((a, b) => (a.success ? a.latency_ms : 99999) - (b.success ? b.latency_ms : 99999))
                      .map((res, idx) => (
                        <div
                          key={`${res.provider}-${res.model}-${idx}`}
                          className={`p-3 rounded-lg border text-xs flex flex-col gap-1.5 transition ${
                            res.success
                              ? "bg-zinc-950/70 border-white/[0.06] text-zinc-200"
                              : "bg-rose-950/20 border-rose-900/30 text-rose-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                              <span className="text-[10px] text-zinc-500 font-mono">#{idx + 1}</span>
                              {res.provider}
                              <span className="text-zinc-400 font-mono text-[10px]">({res.model})</span>
                            </span>
                            {res.success ? (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                                  res.latency_ms < 500
                                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                    : res.latency_ms < 1500
                                    ? "bg-sky-500/10 text-sky-300 border border-sky-500/20"
                                    : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                                }`}
                              >
                                ⚡ {res.latency_ms} ms
                              </span>
                            ) : (
                              <span className="text-[10px] text-rose-400 font-medium">Failed</span>
                            )}
                          </div>
                          {res.success ? (
                            <div className="text-[11px] text-zinc-300 bg-zinc-900/50 p-2 rounded-lg border border-white/[0.06] font-serif">
                              "{res.translation}"
                            </div>
                          ) : (
                            <div className="text-[10px] text-rose-400">
                              {res.error || "Connection or auth error"}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
