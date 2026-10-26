export interface AudioDeviceInfo {
  id: string;
  name: string;
  is_default: boolean;
  is_loopback: boolean;
}

export interface AppStatus {
  is_recording: boolean;
  session_id: string | null;
  src_lang: string;
  tgt_lang: string;
}

export interface LiveSubtitleEvent {
  id: string;
  session_id: string;
  speaker: string;
  timestamp_ms: number;
  src_text: string;
  tgt_text: string;
  is_question: boolean;
  is_final: boolean;
  is_edited?: boolean;
}

export interface QuestionSuggestion {
  question_id: string;
  question_text: string;
  question_translation?: string | null;
  talking_points: string[];
  sample_answer: string;
  sample_answer_bilingual?: string | null;
  keywords?: string[];
  created_at: string;
}

export interface KnowledgeProfile {
  id: string;
  name: string;
  profile_type: "interview" | "sales" | "meeting" | "custom";
  content: string;
  is_active: boolean;
  updated_at: string;
}

export interface GlossaryEntry {
  id: number;
  source: string;
  target: string;
  match_key: string;
  created_at: string;
}

export interface SessionRecord {
  id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  src_lang: string;
  tgt_lang: string;
  audio_source: string;
}

export interface TranscriptRecord {
  id: string;
  session_id: string;
  speaker: string;
  timestamp_ms: number;
  src_text: string;
  tgt_text: string;
  is_question: boolean;
  suggested_answer: string | null;
}

export interface TranslationConfig {
  provider: "local" | "openai" | "openai_compatible" | "anthropic" | "gemini";
  local_endpoint: string;
  openai_api_key?: string;
  anthropic_api_key?: string;
  gemini_api_key?: string;
  model_name: string;
  custom_endpoint?: string;
  custom_api_key?: string;
}

export interface ProviderTestResult {
  provider: string;
  model: string;
  latency_ms: number;
  translation: string;
  success: boolean;
  error?: string;
}

export interface AppPreferences {
  src_lang: string;
  tgt_lang: string;
  audio_source?: string | null;
  transcription_mode: "bilingual" | "single";
  copilot_mode: "bilingual" | "single";
  font_size: "sm" | "md" | "lg";
  is_copilot_split: boolean;
}
