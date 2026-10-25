use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationConfig {
    pub provider: String, // "local", "openai", "anthropic", "gemini"
    pub local_endpoint: String, // e.g. "http://127.0.0.1:8080/v1"
    pub openai_api_key: Option<String>,
    pub anthropic_api_key: Option<String>,
    pub gemini_api_key: Option<String>,
    pub model_name: String, // e.g. "hy-mt2-1.8b", "gpt-4o-mini", "claude-3-haiku", "gemini-2.0-flash"
}

impl Default for TranslationConfig {
    fn default() -> Self {
        Self {
            provider: "local".to_string(),
            local_endpoint: "http://127.0.0.1:8080/v1".to_string(),
            openai_api_key: None,
            anthropic_api_key: None,
            gemini_api_key: None,
            model_name: "hy-mt2-1.8b".to_string(),
        }
    }
}

pub struct TranslationEngine {
    client: Client,
    config: TranslationConfig,
}

impl TranslationEngine {
    pub fn new(config: TranslationConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(8))
            .build()
            .unwrap_or_default();
        Self { client, config }
    }

    pub fn update_config(&mut self, config: TranslationConfig) {
        self.config = config;
    }

    /// Injects glossary constraints into the prompt
    pub fn build_prompt(src_text: &str, src_lang: &str, tgt_lang: &str, glossary: &[(String, String)]) -> (String, String) {
        let mut glossary_constraints = String::new();
        let src_lower = src_text.to_lowercase();

        for (source, target) in glossary {
            if src_lower.contains(&source.to_lowercase()) {
                glossary_constraints.push_str(&format!("\n\"{}\" translates to \"{}\"", source, target));
            }
        }

        let mut system = format!(
            "You are a professional real-time meeting translator. Translate the text from {} to {}. \
             Output ONLY the direct translated text with proper punctuation and natural phrasing. Do NOT add notes, explanations, or quotes.",
            src_lang, tgt_lang
        );

        if !glossary_constraints.is_empty() {
            system.push_str(&format!("\nUse the following glossary terminology mapping:{}\n", glossary_constraints));
        }

        (system, src_text.to_string())
    }

    pub async fn translate(&self, src_text: &str, src_lang: &str, tgt_lang: &str, glossary: &[(String, String)]) -> Result<String> {
        if src_text.trim().is_empty() {
            return Ok(String::new());
        }
        if src_lang.eq_ignore_ascii_case(tgt_lang) {
            return Ok(src_text.to_string());
        }

        let (system_prompt, user_content) = Self::build_prompt(src_text, src_lang, tgt_lang, glossary);

        match self.config.provider.as_str() {
            "openai" => self.translate_openai(&system_prompt, &user_content).await,
            "anthropic" => self.translate_anthropic(&system_prompt, &user_content).await,
            "gemini" => self.translate_gemini(&system_prompt, &user_content).await,
            _ => self.translate_local(&system_prompt, &user_content).await,
        }
    }

    async fn translate_local(&self, system_prompt: &str, text: &str) -> Result<String> {
        let url = format!("{}/chat/completions", self.config.local_endpoint.trim_end_matches('/'));
        let body = json!({
            "model": self.config.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            "temperature": 0.1,
            "max_tokens": 512
        });

        let res = self.client.post(&url).json(&body).send().await?;
        if !res.status().is_success() {
            return Err(anyhow::anyhow!("Local MT server returned error: {}", res.status()));
        }
        let json: serde_json::Value = res.json().await?;
        let output = json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or(text)
            .trim()
            .to_string();
        Ok(output)
    }

    async fn translate_openai(&self, system_prompt: &str, text: &str) -> Result<String> {
        let api_key = self.config.openai_api_key.as_deref().unwrap_or_default();
        let body = json!({
            "model": if self.config.model_name.is_empty() { "gpt-4o-mini" } else { &self.config.model_name },
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            "temperature": 0.2
        });

        let res = self.client.post("https://api.openai.com/v1/chat/completions")
            .bearer_auth(api_key)
            .json(&body)
            .send()
            .await?;
        let json: serde_json::Value = res.json().await?;
        let output = json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or(text)
            .trim()
            .to_string();
        Ok(output)
    }

    async fn translate_anthropic(&self, system_prompt: &str, text: &str) -> Result<String> {
        let api_key = self.config.anthropic_api_key.as_deref().unwrap_or_default();
        let body = json!({
            "model": if self.config.model_name.is_empty() { "claude-3-haiku-20240307" } else { &self.config.model_name },
            "max_tokens": 512,
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": text}
            ]
        });

        let res = self.client.post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await?;
        let json: serde_json::Value = res.json().await?;
        let output = json["content"][0]["text"]
            .as_str()
            .unwrap_or(text)
            .trim()
            .to_string();
        Ok(output)
    }

    async fn translate_gemini(&self, system_prompt: &str, text: &str) -> Result<String> {
        let api_key = self.config.gemini_api_key.as_deref().unwrap_or_default();
        let model = if self.config.model_name.is_empty() { "gemini-2.0-flash" } else { &self.config.model_name };
        let url = format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}", model, api_key);

        let body = json!({
            "system_instruction": {
                "parts": [{ "text": system_prompt }]
            },
            "contents": [{
                "parts": [{ "text": text }]
            }]
        });

        let res = self.client.post(&url).json(&body).send().await?;
        let json: serde_json::Value = res.json().await?;
        let output = json["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .unwrap_or(text)
            .trim()
            .to_string();
        Ok(output)
    }
}
