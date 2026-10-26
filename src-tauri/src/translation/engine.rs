use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationConfig {
    pub provider: String, // "local", "openai", "openai_compatible", "anthropic", "gemini"
    pub local_endpoint: String, // e.g. "http://127.0.0.1:8080/v1"
    pub openai_api_key: Option<String>,
    pub anthropic_api_key: Option<String>,
    pub gemini_api_key: Option<String>,
    pub model_name: String, // e.g. "hy-mt2-1.8b", "gpt-4o-mini", "claude-3-haiku", "gemini-2.0-flash"
    pub custom_endpoint: Option<String>, // Base URL for OpenAI-compatible (e.g. "https://api.deepseek.com/v1")
    pub custom_api_key: Option<String>,
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
            custom_endpoint: Some("https://api.deepseek.com/v1".to_string()),
            custom_api_key: None,
        }
    }
}

/// Normalizes an OpenAI-compatible endpoint URL to always end with `/chat/completions`.
pub fn normalize_openai_endpoint(raw: &str) -> String {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return "https://api.deepseek.com/v1/chat/completions".to_string();
    }
    if trimmed.ends_with("/chat/completions") {
        trimmed.to_string()
    } else {
        format!("{}/chat/completions", trimmed)
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

        let mut system = if src_lang.eq_ignore_ascii_case("auto") {
            format!(
                "You are a professional real-time meeting translator. Automatically detect the spoken source language (multilingual meeting speech) and translate the text accurately to {}. \
                 If the source text is already in {}, polish and retain the phrasing naturally without translating to another language. \
                 Output ONLY the direct translated text with proper punctuation and natural phrasing. Do NOT add notes, explanations, or quotes.",
                tgt_lang, tgt_lang
            )
        } else {
            format!(
                "You are a professional real-time meeting translator. Translate the text from {} to {}. \
                 Output ONLY the direct translated text with proper punctuation and natural phrasing. Do NOT add notes, explanations, or quotes.",
                src_lang, tgt_lang
            )
        };

        if !glossary_constraints.is_empty() {
            system.push_str(&format!("\nUse the following glossary terminology mapping:{}\n", glossary_constraints));
        }

        (system, src_text.to_string())
    }

    pub async fn translate(&self, src_text: &str, src_lang: &str, tgt_lang: &str, glossary: &[(String, String)]) -> Result<String> {
        if src_text.trim().is_empty() {
            return Ok(String::new());
        }
        if !src_lang.eq_ignore_ascii_case("auto") && src_lang.eq_ignore_ascii_case(tgt_lang) {
            return Ok(src_text.to_string());
        }

        let (system_prompt, user_content) = Self::build_prompt(src_text, src_lang, tgt_lang, glossary);

        match self.config.provider.as_str() {
            "openai" => self.translate_openai(&system_prompt, &user_content).await,
            "openai_compatible" => self.translate_openai_compatible(&system_prompt, &user_content).await,
            "anthropic" => self.translate_anthropic(&system_prompt, &user_content).await,
            "gemini" => self.translate_gemini(&system_prompt, &user_content).await,
            _ => self.translate_local(&system_prompt, &user_content).await,
        }
    }

    async fn translate_openai_compatible(&self, system_prompt: &str, text: &str) -> Result<String> {
        let endpoint_raw = self
            .config
            .custom_endpoint
            .as_deref()
            .unwrap_or("https://api.deepseek.com/v1");
        let url = normalize_openai_endpoint(endpoint_raw);

        let api_key = self.config.custom_api_key.as_deref().unwrap_or_default();
        let model = if self.config.model_name.is_empty() {
            "deepseek-chat"
        } else {
            &self.config.model_name
        };

        let body = json!({
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            "temperature": 0.2
        });

        let mut req = self.client.post(&url);
        if !api_key.is_empty() {
            req = req.bearer_auth(api_key);
        }

        let res = req.json(&body).send().await?;
        if !res.status().is_success() {
            let status = res.status();
            let err_body = res.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("OpenAI-Compatible server error {}: {}", status, err_body));
        }

        let json: serde_json::Value = res.json().await?;
        let output = json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or(text)
            .trim()
            .to_string();
        Ok(output)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_openai_endpoint() {
        assert_eq!(
            normalize_openai_endpoint("https://api.deepseek.com/v1"),
            "https://api.deepseek.com/v1/chat/completions"
        );
        assert_eq!(
            normalize_openai_endpoint("https://api.deepseek.com/v1/"),
            "https://api.deepseek.com/v1/chat/completions"
        );
        assert_eq!(
            normalize_openai_endpoint("https://api.groq.com/openai/v1/chat/completions"),
            "https://api.groq.com/openai/v1/chat/completions"
        );
        assert_eq!(
            normalize_openai_endpoint("http://localhost:11434/v1"),
            "http://localhost:11434/v1/chat/completions"
        );
        assert_eq!(
            normalize_openai_endpoint("   "),
            "https://api.deepseek.com/v1/chat/completions"
        );
    }

    #[test]
    fn test_config_serialization() {
        let cfg = TranslationConfig {
            provider: "openai_compatible".to_string(),
            local_endpoint: "http://127.0.0.1:8080/v1".to_string(),
            openai_api_key: None,
            anthropic_api_key: None,
            gemini_api_key: None,
            model_name: "deepseek-chat".to_string(),
            custom_endpoint: Some("https://api.deepseek.com/v1".to_string()),
            custom_api_key: Some("sk-test123".to_string()),
        };

        let serialized = serde_json::to_string(&cfg).expect("Serialize config");
        assert!(serialized.contains("openai_compatible"));
        assert!(serialized.contains("https://api.deepseek.com/v1"));
        assert!(serialized.contains("sk-test123"));

        let deserialized: TranslationConfig = serde_json::from_str(&serialized).expect("Deserialize config");
        assert_eq!(deserialized.provider, "openai_compatible");
        assert_eq!(deserialized.custom_endpoint, Some("https://api.deepseek.com/v1".to_string()));
        assert_eq!(deserialized.custom_api_key, Some("sk-test123".to_string()));
    }

    #[test]
    fn test_build_prompt_auto_detect() {
        let (system_prompt, text) = TranslationEngine::build_prompt(
            "Hello team, how is the microservices migration going?",
            "auto",
            "vi",
            &[("microservices".to_string(), "kiến trúc microservices".to_string())],
        );

        assert!(system_prompt.contains("Automatically detect the spoken source language"));
        assert!(system_prompt.contains("accurately to vi"));
        assert!(system_prompt.contains("\"microservices\" translates to \"kiến trúc microservices\""));
        assert_eq!(text, "Hello team, how is the microservices migration going?");
    }
}
