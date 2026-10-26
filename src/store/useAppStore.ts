import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  AppStatus,
  AudioDeviceInfo,
  LiveSubtitleEvent,
  QuestionSuggestion,
  KnowledgeProfile,
  GlossaryEntry,
  SessionRecord,
  TranslationConfig,
  AppPreferences,
} from "../types";

interface AppState {
  status: AppStatus;
  audioSources: AudioDeviceInfo[];
  selectedAudioSource: string;
  srcLang: string;
  tgtLang: string;
  subtitles: LiveSubtitleEvent[];
  latestSuggestion: QuestionSuggestion | null;
  copilotHistory: QuestionSuggestion[];
  profiles: KnowledgeProfile[];
  activeProfile: KnowledgeProfile | null;
  glossary: GlossaryEntry[];
  sessions: SessionRecord[];
  settings: TranslationConfig;
  audioLevel: number;
  overlayLocked: boolean;
  overlayVisible: boolean;
  copilotVisible: boolean;
  copilotLocked: boolean;
  isCopilotSplit: boolean;
  transcriptionMode: "bilingual" | "single";
  copilotMode: "bilingual" | "single";
  fontSize: "sm" | "md" | "lg";

  // Actions
  init: () => Promise<void>;
  startSession: (title: string) => Promise<void>;
  stopSession: () => Promise<void>;
  setSelectedAudioSource: (id: string) => void;
  setLanguages: (src: string, tgt: string) => void;
  setTranscriptionMode: (mode: "bilingual" | "single") => void;
  setCopilotMode: (mode: "bilingual" | "single") => void;
  setFontSize: (size: "sm" | "md" | "lg") => void;
  updateSubtitle: (id: string, srcText: string, tgtText: string) => Promise<void>;
  simulateSpeech: (speaker: string, text: string) => Promise<void>;
  askCopilotManual: (question: string) => Promise<void>;
  setOverlayLocked: (locked: boolean) => Promise<void>;
  setOverlayVisible: (visible: boolean) => Promise<void>;
  toggleOverlayVisible: () => Promise<void>;
  setCopilotVisible: (visible: boolean) => Promise<void>;
  toggleCopilotVisible: () => Promise<void>;
  setCopilotLocked: (locked: boolean) => Promise<void>;
  setCopilotSplit: (split: boolean) => Promise<void>;
  toggleCopilotSplit: () => Promise<void>;
  loadProfiles: () => Promise<void>;
  saveProfile: (profile: KnowledgeProfile) => Promise<void>;
  setActiveProfile: (id: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  loadGlossary: () => Promise<void>;
  addGlossaryEntry: (source: string, target: string) => Promise<void>;
  deleteGlossaryEntry: (id: number) => Promise<void>;
  loadHistory: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  exportTranscript: (sessionId: string, format: "srt" | "md" | "csv") => Promise<string>;
  saveSettings: (settings: TranslationConfig) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  status: { is_recording: false, session_id: null, src_lang: "en", tgt_lang: "vi" },
  audioSources: [],
  selectedAudioSource: "system_audio",
  srcLang: "en",
  tgtLang: "vi",
  subtitles: [],
  latestSuggestion: null,
  copilotHistory: [],
  profiles: [],
  activeProfile: null,
  glossary: [],
  sessions: [],
  settings: {
    provider: "local",
    local_endpoint: "http://127.0.0.1:8080/v1",
    model_name: "hy-mt2-1.8b",
  },
  audioLevel: 0,
  overlayLocked: false,
  overlayVisible: false,
  copilotVisible: false,
  copilotLocked: false,
  isCopilotSplit: true,
  transcriptionMode: "bilingual",
  copilotMode: "bilingual",
  fontSize: "md",

  init: async () => {
    try {
      const [sources, settings, status, profiles, glossary, prefs] = await Promise.all([
        invoke<AudioDeviceInfo[]>("list_audio_sources").catch(() => []),
        invoke<TranslationConfig>("get_settings").catch(() => get().settings),
        invoke<AppStatus>("get_app_status").catch(() => get().status),
        invoke<KnowledgeProfile[]>("list_profiles").catch(() => []),
        invoke<GlossaryEntry[]>("list_glossary").catch(() => []),
        invoke<AppPreferences>("get_app_preferences").catch(() => null),
      ]);

      const activeProfile = profiles.find((p) => p.is_active) || null;
      const preferredSource = prefs?.audio_source && sources.some((s) => s.id === prefs.audio_source)
        ? prefs.audio_source
        : sources.find((s) => s.is_default)?.id || sources[0]?.id || "system_audio";

      set({
        audioSources: sources,
        selectedAudioSource: preferredSource,
        settings,
        status,
        profiles,
        activeProfile,
        glossary,
        isCopilotSplit: prefs?.is_copilot_split ?? true,
        srcLang: prefs?.src_lang || status.src_lang || "en",
        tgtLang: prefs?.tgt_lang || status.tgt_lang || "vi",
        transcriptionMode: (prefs?.transcription_mode as any) || "bilingual",
        copilotMode: (prefs?.copilot_mode as any) || "bilingual",
        fontSize: (prefs?.font_size as any) || "md",
      });

      // Listen for backend real-time events
      await listen<LiveSubtitleEvent>("subtitle:stream", (event) => {
        set((state) => ({
          subtitles: [...state.subtitles.slice(-30), event.payload],
        }));
      });

      await listen<QuestionSuggestion>("copilot:suggestion", (event) => {
        set((state) => ({
          latestSuggestion: event.payload,
          copilotHistory: [event.payload, ...state.copilotHistory.slice(0, 19)],
        }));
      });

      await listen<number>("audio:level", (event) => {
        set({ audioLevel: event.payload });
      });

      await listen<boolean>("overlay:lock_changed", (event) => {
        set({ overlayLocked: event.payload });
      });

      await listen<boolean>("overlay:visibility_changed", (event) => {
        set({ overlayVisible: event.payload });
      });

      await listen<boolean>("copilot:visibility_changed", (event) => {
        set({ copilotVisible: event.payload });
      });

      await listen<boolean>("copilot:lock_changed", (event) => {
        set({ copilotLocked: event.payload });
      });

      await listen<boolean>("copilot:split_changed", (event) => {
        set({ isCopilotSplit: event.payload });
      });

      await listen<{ id: string; src_text: string; tgt_text: string }>("subtitle:updated", (event) => {
        const { id, src_text, tgt_text } = event.payload;
        set((state) => ({
          subtitles: state.subtitles.map((sub) =>
            sub.id === id ? { ...sub, src_text, tgt_text, is_edited: true } : sub
          ),
        }));
      });

      await listen("session:stopped", () => {
        set((state) => ({
          status: { ...state.status, is_recording: false, session_id: null },
        }));
      });
    } catch (err) {
      console.warn("Failed to initialize store:", err);
    }
  },

  startSession: async (title: string) => {
    const { srcLang, tgtLang, selectedAudioSource } = get();
    const sessionId = await invoke<string>("start_session", {
      title,
      srcLang,
      tgtLang,
      audioSource: selectedAudioSource,
    });
    set((state) => ({
      status: { is_recording: true, session_id: sessionId, src_lang: srcLang, tgt_lang: tgtLang },
      subtitles: [],
      latestSuggestion: null,
    }));
  },

  stopSession: async () => {
    await invoke("stop_session");
    set((state) => ({
      status: { ...state.status, is_recording: false, session_id: null },
    }));
    await get().loadHistory();
  },

  setSelectedAudioSource: (id: string) => {
    set({ selectedAudioSource: id });
    const s = get();
    invoke("update_app_preferences", {
      preferences: {
        src_lang: s.srcLang,
        tgt_lang: s.tgtLang,
        audio_source: id,
        transcription_mode: s.transcriptionMode,
        copilot_mode: s.copilotMode,
        font_size: s.fontSize,
        is_copilot_split: s.isCopilotSplit,
      },
    }).catch(console.error);
  },

  setLanguages: (src: string, tgt: string) => {
    set({ srcLang: src, tgtLang: tgt });
    const s = get();
    invoke("update_app_preferences", {
      preferences: {
        src_lang: src,
        tgt_lang: tgt,
        audio_source: s.selectedAudioSource,
        transcription_mode: s.transcriptionMode,
        copilot_mode: s.copilotMode,
        font_size: s.fontSize,
        is_copilot_split: s.isCopilotSplit,
      },
    }).catch(console.error);
  },

  setTranscriptionMode: (mode: "bilingual" | "single") => {
    set({ transcriptionMode: mode });
    const s = get();
    invoke("update_app_preferences", {
      preferences: {
        src_lang: s.srcLang,
        tgt_lang: s.tgtLang,
        audio_source: s.selectedAudioSource,
        transcription_mode: mode,
        copilot_mode: s.copilotMode,
        font_size: s.fontSize,
        is_copilot_split: s.isCopilotSplit,
      },
    }).catch(console.error);
  },

  setCopilotMode: (mode: "bilingual" | "single") => {
    set({ copilotMode: mode });
    const s = get();
    invoke("update_app_preferences", {
      preferences: {
        src_lang: s.srcLang,
        tgt_lang: s.tgtLang,
        audio_source: s.selectedAudioSource,
        transcription_mode: s.transcriptionMode,
        copilot_mode: mode,
        font_size: s.fontSize,
        is_copilot_split: s.isCopilotSplit,
      },
    }).catch(console.error);
  },

  setFontSize: (size: "sm" | "md" | "lg") => {
    set({ fontSize: size });
    const s = get();
    invoke("update_app_preferences", {
      preferences: {
        src_lang: s.srcLang,
        tgt_lang: s.tgtLang,
        audio_source: s.selectedAudioSource,
        transcription_mode: s.transcriptionMode,
        copilot_mode: s.copilotMode,
        font_size: size,
        is_copilot_split: s.isCopilotSplit,
      },
    }).catch(console.error);
  },

  updateSubtitle: async (id: string, srcText: string, tgtText: string) => {
    try {
      await invoke("update_transcript", { id, srcText, tgtText });
      set((state) => ({
        subtitles: state.subtitles.map((sub) =>
          sub.id === id ? { ...sub, src_text: srcText, tgt_text: tgtText, is_edited: true } : sub
        ),
      }));
    } catch (e) {
      console.error("Failed to update transcript:", e);
    }
  },

  simulateSpeech: async (speaker: string, text: string) => {
    await invoke("process_speech_chunk", { speaker, srcText: text });
  },

  askCopilotManual: async (question: string) => {
    const suggestion = await invoke<QuestionSuggestion>("ask_copilot_manual", {
      questionText: question,
    });
    set((state) => ({
      latestSuggestion: suggestion,
      copilotHistory: [suggestion, ...state.copilotHistory],
    }));
  },

  setOverlayLocked: async (locked: boolean) => {
    await invoke("set_overlay_locked", { locked });
    set({ overlayLocked: locked });
  },

  setOverlayVisible: async (visible: boolean) => {
    await invoke("set_overlay_visible", { visible });
    set({ overlayVisible: visible });
  },

  toggleOverlayVisible: async () => {
    try {
      const isVis = await invoke<boolean>("toggle_overlay_visible");
      set({ overlayVisible: isVis });
    } catch (e) {
      console.warn("Failed to toggle overlay:", e);
    }
  },

  setCopilotVisible: async (visible: boolean) => {
    await invoke("set_copilot_visible", { visible });
    set({ copilotVisible: visible });
  },

  toggleCopilotVisible: async () => {
    try {
      const isVis = await invoke<boolean>("toggle_copilot_visible");
      set({ copilotVisible: isVis });
    } catch (e) {
      console.warn("Failed to toggle copilot visible:", e);
    }
  },

  setCopilotLocked: async (locked: boolean) => {
    await invoke("set_copilot_locked", { locked });
    set({ copilotLocked: locked });
  },

  setCopilotSplit: async (split: boolean) => {
    await invoke("set_copilot_split_mode", { isSplit: split });
    set({ isCopilotSplit: split });
  },

  toggleCopilotSplit: async () => {
    const next = !get().isCopilotSplit;
    await invoke("set_copilot_split_mode", { isSplit: next });
    set({ isCopilotSplit: next });
  },

  loadProfiles: async () => {
    const profiles = await invoke<KnowledgeProfile[]>("list_profiles");
    const active = profiles.find((p) => p.is_active) || null;
    set({ profiles, activeProfile: active });
  },

  saveProfile: async (profile: KnowledgeProfile) => {
    await invoke("save_profile", { profile });
    await get().loadProfiles();
  },

  setActiveProfile: async (id: string) => {
    await invoke("set_active_profile", { id });
    await get().loadProfiles();
  },

  deleteProfile: async (id: string) => {
    await invoke("delete_profile", { id });
    await get().loadProfiles();
  },

  loadGlossary: async () => {
    const glossary = await invoke<GlossaryEntry[]>("list_glossary");
    set({ glossary });
  },

  addGlossaryEntry: async (source: string, target: string) => {
    await invoke("add_glossary_entry", { source, target });
    await get().loadGlossary();
  },

  deleteGlossaryEntry: async (id: number) => {
    await invoke("delete_glossary_entry", { id });
    await get().loadGlossary();
  },

  loadHistory: async () => {
    const sessions = await invoke<SessionRecord[]>("list_history");
    set({ sessions });
  },

  deleteSession: async (id: string) => {
    await invoke("delete_history_session", { sessionId: id });
    await get().loadHistory();
  },

  clearHistory: async () => {
    await invoke("clear_history");
    set({ sessions: [], subtitles: [] });
  },

  exportTranscript: async (sessionId: string, format: "srt" | "md" | "csv") => {
    return await invoke<string>("export_transcript", { sessionId, format });
  },

  saveSettings: async (settings: TranslationConfig) => {
    await invoke("update_settings", { settings });
    set({ settings });
  },
}));
