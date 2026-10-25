use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;

use crate::translation::TranslationConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestionSuggestion {
    pub question_id: String,
    pub question_text: String,
    pub talking_points: Vec<String>,
    pub sample_answer: String,
    pub created_at: String,
}

pub struct CopilotSuggester {
    client: Client,
    config: TranslationConfig,
}

impl CopilotSuggester {
    pub fn new(config: TranslationConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(12))
            .build()
            .unwrap_or_default();
        Self { client, config }
    }

    pub fn update_config(&mut self, config: TranslationConfig) {
        self.config = config;
    }

    pub async fn generate_suggestion(
        &self,
        question_id: &str,
        question_text: &str,
        recent_dialogue: &[String],
        knowledge_context: Option<&str>,
        response_lang: &str,
    ) -> Result<QuestionSuggestion> {
        let dialogue_context = if recent_dialogue.is_empty() {
            "No prior conversation turns.".to_string()
        } else {
            recent_dialogue.join("\n")
        };

        let profile_section = match knowledge_context {
            Some(content) if !content.trim().is_empty() => {
                format!("\nUSER BACKGROUND / KNOWLEDGE BASE:\n\"\"\"\n{}\n\"\"\"\n", content)
            }
            _ => String::new(),
        };

        let system_prompt = format!(
            "You are an elite real-time Meeting & Interview Copilot assistant for the user.\n\
             A question was just asked in the meeting/interview.\n\
             Your task is to provide the user with instantaneous, high-impact answer assistance in {}.\n\
             {}\n\
             Format your output strictly as a JSON object with two fields:\n\
             1. \"talking_points\": an array of 2 to 3 concise, punchy bullet points the user should highlight.\n\
             2. \"sample_answer\": a natural, professional 1-2 sentence suggested answer the user can say or type immediately.\n\
             Do not include markdown code block wrappers (like ```json), output raw valid JSON.",
            response_lang,
            profile_section
        );

        let user_prompt = format!(
            "RECENT CONVERSATION TURNS:\n{}\n\nDETECTED QUESTION TO ANSWER:\n\"{}\"",
            dialogue_context, question_text
        );

        let response_text = match self.config.provider.as_str() {
            "openai" => self.query_openai(&system_prompt, &user_prompt).await?,
            "openai_compatible" => self.query_openai_compatible(&system_prompt, &user_prompt).await?,
            "anthropic" => self.query_anthropic(&system_prompt, &user_prompt).await?,
            "gemini" => self.query_gemini(&system_prompt, &user_prompt).await?,
            _ => self.query_local(&system_prompt, &user_prompt).await?,
        };

        // Parse JSON output or fallback safely
        let (talking_points, sample_answer) = Self::parse_suggestion_json(&response_text);

        Ok(QuestionSuggestion {
            question_id: question_id.to_string(),
            question_text: question_text.to_string(),
            talking_points,
            sample_answer,
            created_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    fn parse_suggestion_json(raw: &str) -> (Vec<String>, String) {
        let cleaned = raw.trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        if let Ok(val) = serde_json::from_str::<serde_json::Value>(cleaned) {
            let mut points = Vec::new();
            if let Some(arr) = val["talking_points"].as_array() {
                for item in arr {
                    if let Some(s) = item.as_str() {
                        points.push(s.to_string());
                    }
                }
            }
            let answer = val["sample_answer"].as_str().unwrap_or("").to_string();
            if !points.is_empty() || !answer.is_empty() {
                return (points, answer);
            }
        }

        // Fallback: parse plain lines
        let lines: Vec<String> = raw.lines().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
        (lines.clone(), raw.to_string())
    }

    async fn query_local(&self, system: &str, user: &str) -> Result<String> {
        let url = format!("{}/chat/completions", self.config.local_endpoint.trim_end_matches('/'));
        let body = json!({
            "model": self.config.model_name,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user}
            ],
            "temperature": 0.3,
            "max_tokens": 512
        });

        let res = self.client.post(&url).json(&body).send().await?;
        let json: serde_json::Value = res.json().await?;
        let text = json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();
        Ok(text)
    }

    async fn query_openai(&self, system: &str, user: &str) -> Result<String> {
        let api_key = self.config.openai_api_key.as_deref().unwrap_or_default();
        let body = json!({
            "model": if self.config.model_name.is_empty() { "gpt-4o-mini" } else { &self.config.model_name },
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user}
            ],
            "response_format": { "type": "json_object" },
            "temperature": 0.3
        });

        let res = self.client.post("https://api.openai.com/v1/chat/completions")
            .bearer_auth(api_key)
            .json(&body)
            .send()
            .await?;
        let json: serde_json::Value = res.json().await?;
        let text = json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();
        Ok(text)
    }

    async fn query_openai_compatible(&self, system: &str, user: &str) -> Result<String> {
        let endpoint_raw = self
            .config
            .custom_endpoint
            .as_deref()
            .unwrap_or("https://api.deepseek.com/v1");
        let url = crate::translation::engine::normalize_openai_endpoint(endpoint_raw);

        let api_key = self.config.custom_api_key.as_deref().unwrap_or_default();
        let model = if self.config.model_name.is_empty() {
            "deepseek-chat"
        } else {
            &self.config.model_name
        };

        let body = json!({
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user}
            ],
            "temperature": 0.3
        });

        let mut req = self.client.post(&url);
        if !api_key.is_empty() {
            req = req.bearer_auth(api_key);
        }

        let res = req.json(&body).send().await?;
        if !res.status().is_success() {
            let status = res.status();
            let err_body = res.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("OpenAI-Compatible copilot query error (HTTP {}): {}", status, err_body));
        }

        let json: serde_json::Value = res.json().await?;
        let text = json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();
        Ok(text)
    }

    async fn query_anthropic(&self, system: &str, user: &str) -> Result<String> {
        let api_key = self.config.anthropic_api_key.as_deref().unwrap_or_default();
        let body = json!({
            "model": if self.config.model_name.is_empty() { "claude-3-haiku-20240307" } else { &self.config.model_name },
            "max_tokens": 600,
            "system": system,
            "messages": [
                {"role": "user", "content": user}
            ]
        });

        let res = self.client.post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await?;
        let json: serde_json::Value = res.json().await?;
        let text = json["content"][0]["text"]
            .as_str()
            .unwrap_or("")
            .to_string();
        Ok(text)
    }

    async fn query_gemini(&self, system: &str, user: &str) -> Result<String> {
        let api_key = self.config.gemini_api_key.as_deref().unwrap_or_default();
        let model = if self.config.model_name.is_empty() { "gemini-2.0-flash" } else { &self.config.model_name };
        let url = format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}", model, api_key);

        let body = json!({
            "system_instruction": {
                "parts": [{ "text": system }]
            },
            "contents": [{
                "parts": [{ "text": user }]
            }],
            "generationConfig": {
                "response_mime_type": "application/json"
            }
        });

        let res = self.client.post(&url).json(&body).send().await?;
        let json: serde_json::Value = res.json().await?;
        let text = json["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .unwrap_or("")
            .to_string();
        Ok(text)
    }
}
