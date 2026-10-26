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
    alert("Settings saved successfully!");
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
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <div className="w-64 border-r border-slate-800 bg-slate-900/60 p-4 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-bold text-slate-100 leading-none">AI Meets</div>
              <div className="text-[11px] text-indigo-400 font-medium">Translator & Copilot</div>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("live")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "live"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Radio className="w-4 h-4" />
              Live Meeting & Subtitles
            </button>

            <button
              onClick={() => setActiveTab("profiles")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "profiles"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <FileText className="w-4 h-4" />
              Knowledge Profiles (CV/FAQ)
            </button>

            <button
              onClick={() => setActiveTab("glossary")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "glossary"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <BookA className="w-4 h-4" />
              Custom Glossary
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "history"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <History className="w-4 h-4" />
              Meeting History & Export
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "settings"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Settings className="w-4 h-4" />
              AI Models & Settings
            </button>
          </nav>
        </div>

        {/* Bottom Status Panel */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Audio Stream:</span>
            <AudioVisualizer level={audioLevel} active={status.is_recording} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Active Profile:</span>
            <span className="font-semibold text-indigo-300 truncate max-w-[120px]">
              {activeProfile ? activeProfile.name : "None"}
            </span>
          </div>
          {/* Split / Dock Mode Selector */}
          <div className="pt-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>HUD Layout:</span>
              <span className="font-semibold text-indigo-300 text-[10px]">
                {isCopilotSplit ? "Split (2 Boxes)" : "Glued (1 Box)"}
              </span>
            </div>
            <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-[10px]">
              <button
                type="button"
                onClick={() => setCopilotSplit(true)}
                className={`flex-1 py-1 rounded font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                  isCopilotSplit
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Split Subtitles & AI Copilot into 2 independent movable boxes"
              >
                <Layers className="w-3 h-3" /> Split (2 Boxes)
              </button>
              <button
                type="button"
                onClick={() => setCopilotSplit(false)}
                className={`flex-1 py-1 rounded font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                  !isCopilotSplit
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Dock Subtitles & AI Copilot together into 1 box"
              >
                Docked (1 Box)
              </button>
            </div>
          </div>

          {/* Subtitles HUD Toggle */}
          <div className="pt-1 flex gap-1.5">
            <button
              onClick={toggleOverlayVisible}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[11px] font-medium transition cursor-pointer ${
                overlayVisible
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
              title="Toggle Live Subtitles HUD"
            >
              <Eye className="w-3 h-3" /> Subtitles
            </button>
            <button
              onClick={() => setOverlayLocked(!overlayLocked)}
              className={`px-2 py-1 rounded text-[11px] transition cursor-pointer ${
                overlayLocked ? "bg-rose-600 text-white shadow-sm shadow-rose-600/30" : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
              title={overlayLocked ? "Subtitles click-through is locked (clicks pass through)" : "Lock click-through for Subtitles"}
            >
              {overlayLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            </button>
          </div>

          {/* AI Copilot HUD Toggle */}
          <div className="flex gap-1.5">
            <button
              onClick={toggleCopilotVisible}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[11px] font-medium transition cursor-pointer ${
                copilotVisible
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
              title="Toggle AI Copilot HUD Window"
            >
              <Sparkles className="w-3 h-3" /> AI Copilot
            </button>
            <button
              onClick={() => setCopilotLocked(!copilotLocked)}
              className={`px-2 py-1 rounded text-[11px] transition cursor-pointer ${
                copilotLocked ? "bg-rose-600 text-white shadow-sm shadow-rose-600/30" : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
              title={copilotLocked ? "Copilot click-through is locked" : "Lock click-through for Copilot"}
            >
              {copilotLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-auto bg-slate-950">
        {/* Top Control Bar */}
        <header className="border-b border-slate-800 bg-slate-900/40 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="Meeting / Interview Title..."
              disabled={status.is_recording}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-64"
            />

            {/* Audio Source Picker */}
            <select
              value={selectedAudioSource}
              onChange={(e) => setSelectedAudioSource(e.target.value)}
              disabled={status.is_recording}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
            >
              {audioSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Languages */}
            <div className="flex items-center gap-1 text-xs">
              <select
                value={srcLang}
                onChange={(e) => setLanguages(e.target.value, tgtLang)}
                disabled={status.is_recording}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
              >
                <option value="en">English</option>
                <option value="vi">Vietnamese</option>
                <option value="ja">Japanese</option>
                <option value="zh">Chinese</option>
                <option value="ko">Korean</option>
              </select>
              <span className="text-slate-500">→</span>
              <select
                value={tgtLang}
                onChange={(e) => setLanguages(srcLang, e.target.value)}
                disabled={status.is_recording}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
              >
                <option value="vi">Vietnamese</option>
                <option value="en">English</option>
                <option value="ja">Japanese</option>
                <option value="zh">Chinese</option>
                <option value="ko">Korean</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleStartStop}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition shadow-lg ${
              status.is_recording
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 animate-pulse"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30"
            }`}
          >
            {status.is_recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {status.is_recording ? "Stop Meeting" : "Start Meeting"}
          </button>
        </header>

        {/* Tab 1: Live Meeting & Subtitles */}
        {activeTab === "live" && (
          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-auto">
            {/* Live Subtitles Log (2 cols) */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-400" />
                    Live Meeting Dialogue Stream
                  </h2>

                  {/* Translation Mode Toggle */}
                  <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-700/60 text-xs">
                    <button
                      type="button"
                      onClick={() => setTranscriptionMode("bilingual")}
                      className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        transcriptionMode === "bilingual"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                      title="Show both translated text and original spoken speech"
                    >
                      <Globe className="w-3.5 h-3.5" /> Bilingual Mode
                    </button>
                    <button
                      type="button"
                      onClick={() => setTranscriptionMode("single")}
                      className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                        transcriptionMode === "single"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                      title="Show translated subtitles only"
                    >
                      Single Mode
                    </button>
                  </div>
                </div>

                <span className="text-xs text-slate-400">
                  {subtitles.length} utterances captured
                </span>
              </div>

              {/* Subtitles Box */}
              <div className="flex-1 min-h-[380px] bg-slate-900/60 border border-slate-800 rounded-2xl p-4 overflow-y-auto space-y-3 select-text cursor-text">
                {subtitles.length > 0 ? (
                  subtitles.map((sub) => {
                    const isEditing = editingSubtitleId === sub.id;

                    if (isEditing) {
                      return (
                        <div
                          key={sub.id}
                          className="p-3 rounded-xl bg-slate-900 border border-indigo-500/60 space-y-2 shadow-lg select-auto"
                        >
                          <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold">
                            <span>Editing Utterance ({sub.speaker}):</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveEditSubtitle(sub.id)}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" /> Save
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditSubtitle}
                                className="p-1 rounded text-slate-400 hover:text-slate-200 transition cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase font-semibold">
                              Translated Text
                            </label>
                            <input
                              type="text"
                              value={editSubTgtText}
                              onChange={(e) => setEditSubTgtText(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 mt-0.5"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase font-semibold">
                              Original Spoken Text
                            </label>
                            <input
                              type="text"
                              value={editSubSrcText}
                              onChange={(e) => setEditSubSrcText(e.target.value)}
                              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 italic focus:outline-none focus:border-indigo-500 mt-0.5"
                            />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={sub.id}
                        className={`p-3 rounded-xl border transition group/item select-text ${
                          sub.is_question
                            ? "bg-amber-950/20 border-amber-500/30"
                            : "bg-slate-800/40 border-slate-700/40"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold uppercase text-[10px] ${
                                sub.speaker === "Me" ? "bg-emerald-500/20 text-emerald-300" : "bg-sky-500/20 text-sky-300"
                              }`}
                            >
                              {sub.speaker}
                            </span>
                            {sub.is_question && (
                              <span className="px-1.5 py-0.5 rounded font-semibold text-[10px] bg-amber-500/20 text-amber-300">
                                ❓ Question
                              </span>
                            )}
                            {sub.is_edited && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                Edited
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500">
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
                                className="p-1 rounded hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 transition cursor-pointer"
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
                                className="p-1 rounded hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                                title="Edit utterance text"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Primary Translated Text */}
                        <div className="text-sm font-semibold text-slate-100 select-text leading-snug">
                          {sub.tgt_text}
                        </div>

                        {/* Secondary Spoken Text (Bilingual Mode) */}
                        {transcriptionMode === "bilingual" && (
                          <div className="text-xs text-slate-400 italic mt-0.5 select-text">
                            {sub.src_text}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                    <Mic className="w-8 h-8 opacity-40" />
                    <p className="text-xs">
                      Click "Start Meeting" or use the Speech Simulation tool below to test live translation!
                    </p>
                  </div>
                )}
              </div>

              {/* Speech Simulator / Tester */}
              <form onSubmit={handleSimulate} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 flex items-center gap-2">
                <select
                  value={testSpeaker}
                  onChange={(e) => setTestSpeaker(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
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
                  className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />

                <button
                  type="submit"
                  disabled={!testSpeechText.trim()}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1 transition shrink-0"
                >
                  <Play className="w-3 h-3" /> Simulate
                </button>
              </form>
            </div>

            {/* AI Copilot Answer Suggestion Column */}
            <div className="flex flex-col gap-4">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                AI Answer Suggestion Copilot
              </h2>
              <CopilotCard suggestion={latestSuggestion} onAskManual={askCopilotManual} />
            </div>
          </div>
        )}

        {/* Tab 2: Knowledge Profiles */}
        {activeTab === "profiles" && (
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-auto">
            {/* Create Profile */}
            <form onSubmit={handleCreateProfile} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                Add Context / Knowledge Profile
              </h2>
              <p className="text-xs text-slate-400">
                Ground the AI answer suggestions with your resume (for technical interviews), product battlecards (for sales), or meeting agendas!
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Profile Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g., Senior Full-Stack Engineer CV 2026"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Profile Type</label>
                <select
                  value={profileType}
                  onChange={(e) => setProfileType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none"
                >
                  <option value="interview">Job Interview (CV, Experience, Tech Stack)</option>
                  <option value="sales">Sales & Demo (Product FAQs, Pricing, Competitors)</option>
                  <option value="meeting">Business Meeting (Agenda, Specifications)</option>
                  <option value="custom">Custom Knowledge Base</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Knowledge Base Content (Paste Markdown or Plain Text)
                </label>
                <textarea
                  rows={9}
                  value={profileContent}
                  onChange={(e) => setProfileContent(e.target.value)}
                  placeholder="Paste your CV, project achievements, technical strengths, product specifications, or interview preparation notes here..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={!profileName.trim() || !profileContent.trim()}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs rounded-xl transition"
              >
                Save Knowledge Profile
              </button>
            </form>

            {/* Existing Profiles List */}
            <div className="space-y-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Active & Saved Profiles ({profiles.length})
              </h2>

              <div className="space-y-3">
                {profiles.map((p) => (
                  <div
                    key={p.id}
                    className={`p-4 rounded-2xl border transition ${
                      p.is_active
                        ? "bg-indigo-950/30 border-indigo-500/50 shadow-lg shadow-indigo-500/10"
                        : "bg-slate-900/60 border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-100">{p.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-800 text-slate-300">
                          {p.profile_type}
                        </span>
                        {p.is_active && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle className="w-3 h-3" /> Active Profile
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!p.is_active && (
                          <button
                            onClick={() => setActiveProfile(p.id)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-indigo-600/40 hover:bg-indigo-600 text-indigo-200 transition"
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          onClick={() => deleteProfile(p.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition"
                          title="Delete profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-3 font-mono bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
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
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-auto">
            {/* Add Glossary Term */}
            <form onSubmit={handleAddGlossary} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                Add Glossary Term
              </h2>
              <p className="text-xs text-slate-400">
                Ensure technical jargon, brand names, or specific acronyms translate exactly as specified!
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Source Term</label>
                <input
                  type="text"
                  value={glossarySource}
                  onChange={(e) => setGlossarySource(e.target.value)}
                  placeholder="e.g., Kubernetes Pod"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Translation</label>
                <input
                  type="text"
                  value={glossaryTarget}
                  onChange={(e) => setGlossaryTarget(e.target.value)}
                  placeholder="e.g., Cụm Kubernetes Pod"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={!glossarySource.trim() || !glossaryTarget.trim()}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs rounded-xl transition"
              >
                Add Term to Dictionary
              </button>
            </form>

            {/* Glossary Table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col space-y-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <BookA className="w-4 h-4 text-indigo-400" />
                Custom Terminology Mappings ({glossary.length})
              </h2>

              <div className="flex-1 overflow-y-auto space-y-2 max-h-[460px]">
                {glossary.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100">{g.source}</span>
                      <span className="text-slate-500">→</span>
                      <span className="font-medium text-emerald-400">{g.target}</span>
                    </div>

                    <button
                      onClick={() => deleteGlossaryEntry(g.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition"
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
          <div className="p-6 space-y-4 flex-1 overflow-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-400" />
                Meeting Sessions ({sessions.length})
              </h2>

              {sessions.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-xs px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All History
                </button>
              )}
            </div>

            <div className="space-y-3">
              {sessions.map((s) => (
                <div key={s.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100">{s.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-semibold">
                        {s.src_lang} → {s.tgt_lang}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Started: {new Date(s.started_at).toLocaleString()} | Source: {s.audio_source}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExport(s.id, "srt")}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
                      title="Export SubRip Subtitles"
                    >
                      <Download className="w-3.5 h-3.5" /> .SRT
                    </button>
                    <button
                      onClick={() => handleExport(s.id, "md")}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
                      title="Export Markdown Transcript"
                    >
                      <Download className="w-3.5 h-3.5" /> .MD
                    </button>
                    <button
                      onClick={() => handleExport(s.id, "csv")}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
                      title="Export CSV data"
                    >
                      <Download className="w-3.5 h-3.5" /> .CSV
                    </button>
                    <button
                      onClick={() => deleteSession(s.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition"
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
          <form onSubmit={handleSaveSettings} className="p-6 max-w-2xl space-y-4 flex-1 overflow-auto">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-400" />
              AI Model & Provider Configuration
            </h2>
            <p className="text-xs text-slate-400">
              Configure your hybrid inference backend. Choose local inference via llama-server / Ollama for 100% privacy, or connect OpenAI, Anthropic, or Gemini for advanced interview QA.
            </p>

            <div className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Active AI Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none"
                >
                  <option value="local">Local llama-server / Ollama (100% Privacy & Zero Cost)</option>
                  <option value="openai_compatible">OpenAI API Compatible (DeepSeek, Groq, OpenRouter, etc.)</option>
                  <option value="openai">OpenAI (GPT-4o-mini / GPT-4o)</option>
                  <option value="anthropic">Anthropic Claude (Claude 3.5 Sonnet / Haiku)</option>
                  <option value="gemini">Google Gemini (Gemini 2.0 Flash / 1.5 Pro)</option>
                </select>
              </div>

              {provider === "openai_compatible" && (
                <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      API Base URL / Endpoint
                    </label>
                    <input
                      type="text"
                      value={customEndpoint}
                      onChange={(e) => setCustomEndpoint(e.target.value)}
                      placeholder="https://api.deepseek.com/v1"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">
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
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                            customEndpoint === preset.endpoint
                              ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/50"
                              : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                          }`}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Custom API Key (Bearer Token)
                    </label>
                    <input
                      type="password"
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      placeholder="sk-... (Leave empty for local endpoints)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              )}

              {provider === "local" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Local HTTP Endpoint</label>
                  <input
                    type="text"
                    value={localEndpoint}
                    onChange={(e) => setLocalEndpoint(e.target.value)}
                    placeholder="http://127.0.0.1:8080/v1"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none font-mono"
                  />
                </div>
              )}

              {provider === "openai" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">OpenAI API Key</label>
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none font-mono"
                  />
                </div>
              )}

              {provider === "anthropic" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Anthropic API Key</label>
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none font-mono"
                  />
                </div>
              )}

              {provider === "gemini" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Google Gemini API Key</label>
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Model Name / Identifier</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="hy-mt2-1.8b or gpt-4o-mini or claude-3-haiku-20240307"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none font-mono"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestProvider}
                  disabled={testingProvider}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-300 font-semibold text-xs rounded-xl border border-slate-700 transition"
                >
                  <Zap className={`w-3.5 h-3.5 text-amber-400 ${testingProvider ? "animate-spin" : ""}`} />
                  {testingProvider ? "Benchmarking Provider..." : "Test Active Provider"}
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition shadow-lg shadow-indigo-600/20"
                >
                  <Save className="w-4 h-4" /> Save Configuration
                </button>
              </div>

              {/* Active Provider Test Result */}
              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs transition ${
                    testResult.success
                      ? "bg-slate-950/80 border-emerald-500/40 text-slate-200"
                      : "bg-rose-950/30 border-rose-500/40 text-rose-300"
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
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          testResult.latency_ms < 500
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : testResult.latency_ms < 1500
                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        ⚡ {testResult.latency_ms} ms
                      </span>
                    )}
                  </div>
                  {testResult.success ? (
                    <div className="space-y-1">
                      <div className="text-[11px] text-slate-400">
                        Input: <span className="italic">"Welcome everyone to our project architecture review meeting."</span>
                      </div>
                      <div className="text-[11px] text-emerald-300 font-medium bg-emerald-950/30 p-2 rounded-lg border border-emerald-900/30">
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
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <BarChart2 className="w-4 h-4 text-indigo-400" />
                    Multi-Provider Comparison & Benchmark
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Evaluate latency and translation fidelity side-by-side across all configured AI backends.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCompareAllProviders}
                  disabled={comparing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 disabled:opacity-50 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-medium transition"
                >
                  <BarChart2 className={`w-3.5 h-3.5 ${comparing ? "animate-pulse" : ""}`} />
                  {comparing ? "Benchmarking All..." : "Compare Providers"}
                </button>
              </div>

              {compareResults.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] text-slate-400 font-medium">
                    Benchmark Results ({compareResults.length} backends evaluated):
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {compareResults
                      .slice()
                      .sort((a, b) => (a.success ? a.latency_ms : 99999) - (b.success ? b.latency_ms : 99999))
                      .map((res, idx) => (
                        <div
                          key={`${res.provider}-${res.model}-${idx}`}
                          className={`p-3 rounded-xl border text-xs flex flex-col gap-1.5 transition ${
                            res.success
                              ? "bg-slate-950/70 border-slate-800 text-slate-200"
                              : "bg-rose-950/20 border-rose-900/30 text-rose-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-500 font-mono">#{idx + 1}</span>
                              {res.provider}
                              <span className="text-slate-400 font-mono text-[10px]">({res.model})</span>
                            </span>
                            {res.success ? (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  res.latency_ms < 500
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : res.latency_ms < 1500
                                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                }`}
                              >
                                ⚡ {res.latency_ms} ms
                              </span>
                            ) : (
                              <span className="text-[10px] text-rose-400 font-medium">Failed</span>
                            )}
                          </div>
                          {res.success ? (
                            <div className="text-[11px] text-slate-300 bg-slate-900/50 p-2 rounded-lg border border-slate-800/60 font-serif">
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
