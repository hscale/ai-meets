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

    pub fn generate_smart_fallback(
        &self,
        question_id: &str,
        question_text: &str,
        _recent_dialogue: &[String],
        knowledge_context: Option<&str>,
        response_lang: &str,
        error_msg: &str,
    ) -> QuestionSuggestion {
        let q_lower = question_text.to_lowercase();
        let is_vi = response_lang.eq_ignore_ascii_case("vi");
        let is_ja = response_lang.eq_ignore_ascii_case("ja");
        let is_zh = response_lang.eq_ignore_ascii_case("zh");

        // 1. Check knowledge context first for matching facts
        let mut profile_facts = Vec::new();
        if let Some(ctx) = knowledge_context {
            for line in ctx.lines() {
                let trimmed = line.trim().trim_start_matches(['-', '*', '•']).trim();
                if trimmed.len() > 10 {
                    let line_lower = trimmed.to_lowercase();
                    let matches_keyword = q_lower.split_whitespace().any(|word| {
                        word.len() > 3 && line_lower.contains(word)
                    });
                    if matches_keyword && profile_facts.len() < 2 {
                        profile_facts.push(trimmed.to_string());
                    }
                }
            }
        }

        let (talking_points, sample_answer) = if q_lower.contains("microservice") || q_lower.contains("migration") || q_lower.contains("database") {
            if is_vi {
                (
                    vec![
                        "Áp dụng chiến lược Expand and Contract (Parallel Run) để migration schema tương thích ngược.".to_string(),
                        "Đảm bảo nguyên tắc Database-per-service; đồng bộ dữ liệu liên service qua Outbox pattern và Kafka/RabbitMQ.".to_string(),
                        "Tự động hóa scripts migration (Flyway/Liquibase) qua pipeline CI/CD trước khi deploy application code.".to_string(),
                    ],
                    "Với kiến trúc microservices, tôi áp dụng mô hình database-per-service kết hợp chiến lược expand-and-contract. Các migration script được version-control và chạy tự động trong CI/CD trước khi deploy code mới để đảm bảo zero downtime.".to_string(),
                )
            } else if is_ja {
                (
                    vec![
                        "Expand and Contract（並行実行）パターンを採用し、後方互換性のあるマイグレーションを実施。".to_string(),
                        "Database-per-service原則を維持し、Transactional Outboxパターンでサービス間を非同期連携。".to_string(),
                        "CI/CDパイプライン（Flyway/Liquibase）でデプロイ前に自動マイグレーションを実行。".to_string(),
                    ],
                    "マイクロサービスではDatabase-per-serviceを前提とし、Expand and Contractパターンで無停止マイグレーションを行います。CI/CD上でスクリプトを事前実行し安全性を担保します。".to_string(),
                )
            } else if is_zh {
                (
                    vec![
                        "采用 Expand and Contract 策略进行向后兼容的数据库架构迁移。".to_string(),
                        "遵循 Database-per-service 原则，利用 Transactional Outbox 模式解耦跨服务数据一致性。".to_string(),
                        "通过 CI/CD 流水线（如 Flyway/Liquibase）在发布服务之前自动执行迁移脚本。".to_string(),
                    ],
                    "在微服务架构中，我严格遵循 Database-per-service 原则并使用 Expand and Contract 策略，在发布服务前通过 CI/CD 自动完成兼容性迁移，确保零停机时间。".to_string(),
                )
            } else {
                (
                    vec![
                        "Adopt the Expand and Contract pattern with backward-compatible schema evolutions.".to_string(),
                        "Maintain the Database-per-Service principle and decouple cross-service data via Transactional Outbox & event messaging.".to_string(),
                        "Automate versioned migration scripts (Flyway/Liquibase/Prisma) in CI/CD before deploying application binaries.".to_string(),
                    ],
                    "In microservices architectures, I follow the database-per-service pattern combined with the expand-and-contract strategy. Migration scripts are versioned and executed automatically via CI/CD before rollout to guarantee zero downtime.".to_string(),
                )
            }
        } else if q_lower.contains("experience") || q_lower.contains("background") || q_lower.contains("yourself") || q_lower.contains("introduce") {
            if is_vi {
                (
                    vec![
                        "Tóm tắt 1-2 dự án tiêu biểu và vai trò chủ chốt (Tech Lead / Core Developer).".to_string(),
                        "Nhấn mạnh thế mạnh về hệ thống phân tán, xử lý tải cao và tối ưu hiệu năng.".to_string(),
                        "Chia sẻ định hướng đóng góp giá trị cụ thể cho mục tiêu của đội ngũ.".to_string(),
                    ],
                    "Tôi có nền tảng vững chắc trong việc xây dựng các hệ thống backend phân tán và giải pháp AI. Tại các dự án gần đây, tôi tập trung tối ưu kiến trúc và dẫn dắt team bàn giao sản phẩm đúng tiến độ.".to_string(),
                )
            } else {
                (
                    vec![
                        "Highlight 1-2 high-impact projects and your leadership role in delivery.".to_string(),
                        "Emphasize core strengths in distributed systems, real-time engines, and AI integration.".to_string(),
                        "Tie your trajectory directly to the goals and technical challenges of this team.".to_string(),
                    ],
                    "I have a proven track record architecting high-performance distributed systems and AI applications. In recent roles, I led end-to-end delivery of mission-critical services while scaling system throughput.".to_string(),
                )
            }
        } else if q_lower.contains("conflict") || q_lower.contains("disagree") || q_lower.contains("trade-off") || q_lower.contains("challenge") {
            if is_vi {
                (
                    vec![
                        "Lắng nghe góc nhìn của đồng nghiệp và làm rõ các giả định kỹ thuật.".to_string(),
                        "Sử dụng dữ liệu đo lường (benchmarks, metric latency/throughput) để đưa ra quyết định khách quan.".to_string(),
                        "Ưu tiên mục tiêu kinh doanh và sự ổn định dài hạn của hệ thống.".to_string(),
                    ],
                    "Khi có bất đồng kỹ thuật, tôi tập trung tách bạch cảm xúc và đối chiếu dữ liệu thực nghiệm hoặc PoC. Chúng tôi phân tích trade-off dựa trên mục tiêu dự án để thống nhất giải pháp tối ưu nhất.".to_string(),
                )
            } else {
                (
                    vec![
                        "Actively listen to understand underlying technical concerns and constraints.".to_string(),
                        "Anchor discussions on objective empirical data, benchmarks, and prototype spikes.".to_string(),
                        "Align on business goals and choose the pragmatic trade-off for maintainability.".to_string(),
                    ],
                    "Whenever technical disagreements arise, I depersonalize the debate and anchor our decision on benchmarks and trade-off analysis aligned with product milestones.".to_string(),
                )
            }
        } else {
            let topic_name = question_text.trim_end_matches(['?', '.', '!']);
            if is_vi {
                (
                    vec![
                        format!("Phân tích mục tiêu cốt lõi và các ràng buộc của: {}", topic_name),
                        "Đưa ra giải pháp thực tế kèm trade-off về độ phức tạp và chi phí vận hành.".to_string(),
                        "Kết nối với kinh nghiệm thực chiến đã triển khai thành công.".to_string(),
                    ],
                    format!("Đối với vấn đề '{}', tôi tiếp cận bằng cách phân rã yêu cầu thành các cấu phần cốt lõi, ưu tiên giải pháp tinh gọn, có khả năng mở rộng và đo lường được hiệu quả.", topic_name),
                )
            } else {
                (
                    vec![
                        format!("Break down key constraints and primary objectives of: {}", topic_name),
                        "Propose a structured solution with explicit trade-offs on complexity and reliability.".to_string(),
                        "Ground the response with practical production experience and metrics.".to_string(),
                    ],
                    format!("Regarding '{}', my approach starts by clarifying core latency and scale constraints, implementing a modular design, and validating with telemetry before full rollout.", topic_name),
                )
            }
        };

        let mut final_points = talking_points;
        for (i, fact) in profile_facts.into_iter().enumerate() {
            if i < final_points.len() {
                final_points[i] = format!("{} (Relevant: {})", final_points[i], fact);
            }
        }

        if error_msg.contains("Connection refused") || error_msg.contains("61") || error_msg.contains("127.0.0.1:8080") {
            let offline_note = if is_vi {
                "💡 Lưu ý: llama-server local (127.0.0.1:8080) chưa bật. Gợi ý được tạo theo mô hình phân tích ngữ cảnh dự phòng. Bạn có thể bật backend hoặc cấu hình OpenAI / DeepSeek trong Cài đặt."
            } else {
                "💡 Note: Local llama-server (127.0.0.1:8080) is offline. Generated via contextual fallback. Connect an API provider in Settings for live cloud AI."
            };
            final_points.push(offline_note.to_string());
        }

        QuestionSuggestion {
            question_id: question_id.to_string(),
            question_text: question_text.to_string(),
            talking_points: final_points,
            sample_answer,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_smart_fallback_database_migrations_en() {
        let suggester = CopilotSuggester::new(TranslationConfig {
            provider: "local".to_string(),
            local_endpoint: "http://127.0.0.1:8080/v1".to_string(),
            openai_api_key: None,
            anthropic_api_key: None,
            gemini_api_key: None,
            model_name: "hy-mt2-1.8b".to_string(),
            custom_endpoint: None,
            custom_api_key: None,
        });

        let fallback = suggester.generate_smart_fallback(
            "q-123",
            "How do you handle microservices database migrations?",
            &[],
            None,
            "en",
            "tcp connect error: Connection refused (os error 61)",
        );

        assert_eq!(fallback.question_id, "q-123");
        assert!(fallback.talking_points.len() >= 3);
        assert!(fallback.talking_points.iter().any(|p| p.contains("Expand and Contract")));
        assert!(fallback.sample_answer.contains("microservices architectures"));
        assert!(fallback.talking_points.iter().any(|p| p.contains("Local llama-server")));
    }

    #[test]
    fn test_smart_fallback_vietnamese() {
        let suggester = CopilotSuggester::new(TranslationConfig {
            provider: "local".to_string(),
            local_endpoint: "http://127.0.0.1:8080/v1".to_string(),
            openai_api_key: None,
            anthropic_api_key: None,
            gemini_api_key: None,
            model_name: "hy-mt2-1.8b".to_string(),
            custom_endpoint: None,
            custom_api_key: None,
        });

        let fallback = suggester.generate_smart_fallback(
            "q-456",
            "How do you handle microservices database migrations?",
            &[],
            None,
            "vi",
            "tcp connect error: Connection refused",
        );

        assert!(fallback.talking_points.iter().any(|p| p.contains("Expand and Contract")));
        assert!(fallback.sample_answer.contains("microservices"));
        assert!(fallback.talking_points.iter().any(|p| p.contains("llama-server local")));
    }
}
