use regex::Regex;
use std::sync::OnceLock;

static QUESTION_PATTERNS: OnceLock<Vec<Regex>> = OnceLock::new();

fn get_patterns() -> &'static Vec<Regex> {
    QUESTION_PATTERNS.get_or_init(|| {
        vec![
            // English interrogatives
            Regex::new(r"(?i)\b(what|why|how|when|where|who|which|whose|whom)\b").unwrap(),
            Regex::new(r"(?i)\b(can|could|would|will|should|do|does|did|is|are|was|were|have|has)\s+(you|we|I|there|it)\b").unwrap(),
            Regex::new(r"(?i)\b(tell me about|explain to me|walk me through|your thoughts on|your experience with|could you clarify)\b").unwrap(),

            // Vietnamese interrogatives
            Regex::new(r"(?i)\b(tại sao|sao lại|làm sao|làm thế nào|như thế nào|thế nào|ra sao)\b").unwrap(),
            Regex::new(r"(?i)\b(khi nào|bao giờ|ở đâu|chỗ nào|cái gì|gì|ai|người nào|bao nhiêu|mấy)\b").unwrap(),
            Regex::new(r"(?i)\b(có phải|phải không|đúng không|được không|chưa|không ạ|nhỉ|hả)\b").unwrap(),
            Regex::new(r"(?i)\b(kinh nghiệm của bạn|bạn có thể chia sẻ|cho mình hỏi|xin hỏi|bạn nghĩ sao)\b").unwrap(),

            // Japanese interrogatives
            Regex::new(r"(どう|なぜ|いつ|どこ|何|どの|誰|ですか|ますか|でしょうか|教えて)").unwrap(),

            // Chinese interrogatives
            Regex::new(r"(为什么|怎么|何时|哪里|什么|哪个|谁|吗|呢|请问|如何)").unwrap(),

            // Korean interrogatives
            Regex::new(r"(어떻게|왜|언제|어디|무엇|누구|입니까|있습니까|알려주세요)").unwrap(),
        ]
    })
}

pub struct QuestionDetector;

impl QuestionDetector {
    /// Detects if an utterance is an interrogative question directed to the user
    pub fn is_question(text: &str) -> bool {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return false;
        }

        // Direct punctuation check
        if trimmed.ends_with('?') || trimmed.ends_with('？') {
            return true;
        }

        // Lexical heuristic check across multi-languages
        let patterns = get_patterns();
        for pattern in patterns {
            if pattern.is_match(trimmed) {
                return true;
            }
        }

        false
    }
}
