use std::collections::HashSet;

use serde_json::Value;

#[derive(Default)]
pub struct Tokens {
    pub input: u64,
    pub output: u64,
    pub cache_write: u64,
    pub cache_read: u64,
}

pub struct FirstTurn {
    pub cache_write: u64,
    pub cache_read: u64,
}

/// What a stream-json transcript said, read one line at a time so a run can be stopped the
/// moment the stream shows it should be.
#[derive(Default)]
pub struct Summary {
    pub saw_result: bool,
    pub ok: bool,
    pub error: Option<String>,
    pub text: String,
    pub structured: Option<Value>,
    pub turns: u64,
    pub seconds: u64,
    pub cost_usd: f64,
    pub tokens: Tokens,
    pub first_turn: Option<FirstTurn>,
    pub compactions: u64,
    pub peak_context: u64,
    last_text: String,
    seen: HashSet<String>,
}

fn count(usage: &Value, name: &str) -> u64 {
    usage[name].as_u64().unwrap_or(0)
}

impl Summary {
    /// Takes raw bytes because a line may not be UTF-8. One that isn't JSON is skipped.
    pub fn feed(&mut self, line: &[u8]) {
        let text = String::from_utf8_lossy(line);
        let Ok(event) = serde_json::from_str::<Value>(&text) else {
            return;
        };
        match event["type"].as_str() {
            Some("assistant") if event["message"].is_object() => self.assistant(&event["message"]),
            Some("system") if event["subtype"] == "compact_boundary" => self.compaction(&event),
            Some("result") => self.result(&event),
            _ => {}
        }
    }

    fn assistant(&mut self, message: &Value) {
        let usage = &message["usage"];
        if usage.is_object() {
            let cache_write = count(usage, "cache_creation_input_tokens");
            let cache_read = count(usage, "cache_read_input_tokens");
            let input = count(usage, "input_tokens");
            self.peak_context = self.peak_context.max(input + cache_write + cache_read);
            if self.seen.insert(message["id"].to_string()) {
                self.tokens.input += input;
                self.tokens.output += count(usage, "output_tokens");
                self.tokens.cache_write += cache_write;
                self.tokens.cache_read += cache_read;
                self.first_turn.get_or_insert(FirstTurn {
                    cache_write,
                    cache_read,
                });
            }
        }
        let blocks = message["content"].as_array().map_or(&[][..], Vec::as_slice);
        let text: String = blocks
            .iter()
            .filter(|block| block["type"] == "text")
            .filter_map(|block| block["text"].as_str())
            .collect();
        if !text.trim().is_empty() {
            self.last_text = text;
        }
    }

    fn compaction(&mut self, event: &Value) {
        self.compactions += 1;
        let before = count(&event["compact_metadata"], "pre_tokens");
        self.peak_context = self.peak_context.max(before);
    }

    fn result(&mut self, event: &Value) {
        self.saw_result = true;
        // A thrashing run has ended with subtype "success" and is_error true, so only the
        // flag says how a run went.
        self.ok = event["is_error"].as_bool() == Some(false);
        self.text = event["result"]
            .as_str()
            .filter(|text| !text.trim().is_empty())
            .unwrap_or(&self.last_text)
            .to_owned();
        self.structured = event
            .get("structured_output")
            .filter(|v| !v.is_null())
            .cloned();
        self.turns = count(event, "num_turns");
        self.seconds = (event["duration_ms"].as_f64().unwrap_or(0.0) / 1000.0).round() as u64;
        self.cost_usd = event["total_cost_usd"].as_f64().unwrap_or(0.0);
        self.take_final_usage(&event["usage"]);
        if !self.ok {
            self.error = Some(result_error(event));
        }
    }

    /// The per-message usage in the stream is written before a message finishes, so its
    /// output count runs short. The result's usage is the session's real total.
    fn take_final_usage(&mut self, usage: &Value) {
        let tokens = &mut self.tokens;
        tokens.input = usage["input_tokens"].as_u64().unwrap_or(tokens.input);
        tokens.output = usage["output_tokens"].as_u64().unwrap_or(tokens.output);
        tokens.cache_write = usage["cache_creation_input_tokens"]
            .as_u64()
            .unwrap_or(tokens.cache_write);
        tokens.cache_read = usage["cache_read_input_tokens"]
            .as_u64()
            .unwrap_or(tokens.cache_read);
    }

    /// The report text a run left, even one that never got to its result event.
    pub fn report_text(&self) -> &str {
        if self.text.is_empty() {
            &self.last_text
        } else {
            &self.text
        }
    }
}

fn result_error(event: &Value) -> String {
    let named = [&event["terminal_reason"], &event["subtype"]]
        .into_iter()
        .filter_map(Value::as_str)
        .find(|name| !name.is_empty() && *name != "success");
    named.unwrap_or("claude reported an error").to_owned()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn summary(events: &[Value]) -> Summary {
        let mut summary = Summary::default();
        for event in events {
            summary.feed(event.to_string().as_bytes());
        }
        summary
    }

    fn message(id: &str, usage: Value) -> Value {
        json!({ "type": "assistant", "message": { "id": id, "usage": usage, "content": [] } })
    }

    fn usage(input: u64, output: u64, write: u64, read: u64) -> Value {
        json!({
            "input_tokens": input,
            "output_tokens": output,
            "cache_creation_input_tokens": write,
            "cache_read_input_tokens": read,
        })
    }

    #[test]
    fn usage_is_summed_once_per_message() {
        let s = summary(&[
            message("a", usage(1, 10, 100, 0)),
            message("a", usage(1, 10, 100, 0)),
            message("b", usage(2, 20, 5, 100)),
            json!({
                "type": "result", "subtype": "success", "is_error": false,
                "result": "## Verdict\nok", "num_turns": 2, "duration_ms": 3000,
                "total_cost_usd": 0.5,
            }),
        ]);
        assert!(s.ok);
        assert_eq!(s.tokens.output, 30);
        assert_eq!(s.tokens.cache_write, 105);
        let first = s.first_turn.as_ref().unwrap();
        assert_eq!((first.cache_write, first.cache_read), (100, 0));
        assert_eq!(s.cost_usd, 0.5);
        assert_eq!(s.seconds, 3);
        assert_eq!(s.report_text(), "## Verdict\nok");
    }

    #[test]
    fn the_results_usage_overrides_the_streams_short_counts() {
        let s = summary(&[
            message("a", json!({ "output_tokens": 3 })),
            json!({
                "type": "result", "subtype": "success", "is_error": false, "result": "r",
                "usage": usage(9, 2870, 10, 20),
            }),
        ]);
        assert_eq!(s.tokens.output, 2870);
        assert_eq!(s.tokens.cache_read, 20);
    }

    #[test]
    fn peak_context_is_the_largest_single_turn() {
        let s = summary(&[
            message("a", usage(1, 500, 30_000, 0)),
            message("b", usage(2, 500, 1_000, 40_000)),
            message("c", usage(1, 500, 100, 20_000)),
        ]);
        assert_eq!(s.peak_context, 41_002);
    }

    #[test]
    fn a_compaction_is_counted_and_its_size_can_set_the_peak() {
        let s = summary(&[
            message("a", usage(1, 1, 1_000, 0)),
            json!({
                "type": "system", "subtype": "compact_boundary",
                "compact_metadata": { "pre_tokens": 151_000, "post_tokens": 17_000 },
            }),
        ]);
        assert_eq!(s.compactions, 1);
        assert_eq!(s.peak_context, 151_000);
    }

    #[test]
    fn other_system_events_are_not_compactions() {
        let s = summary(&[json!({ "type": "system", "subtype": "init" })]);
        assert_eq!(s.compactions, 0);
    }

    #[test]
    fn the_error_flag_beats_a_success_label() {
        let s = summary(&[json!({
            "type": "result", "subtype": "success", "is_error": true,
            "terminal_reason": "rapid_refill_breaker", "result": "partial",
        })]);
        assert!(!s.ok);
        assert_eq!(s.error.as_deref(), Some("rapid_refill_breaker"));
    }

    #[test]
    fn a_result_with_no_error_flag_is_not_trusted() {
        let s = summary(&[json!({ "type": "result", "subtype": "success", "result": "r" })]);
        assert!(!s.ok);
        assert_eq!(s.error.as_deref(), Some("claude reported an error"));
    }

    #[test]
    fn lines_that_are_not_json_or_not_utf8_are_skipped() {
        let mut s = Summary::default();
        s.feed(b"not json");
        s.feed(&[0xff, 0xfe, b'{', 0xc3]);
        s.feed(br#"{"type":"result","is_error":false,"result":"r"}"#);
        assert!(s.ok);
    }

    #[test]
    fn invalid_bytes_inside_a_json_line_do_not_lose_the_event() {
        let mut s = Summary::default();
        let mut line = br#"{"type":"result","is_error":false,"result":"caf"#.to_vec();
        line.push(0xe9);
        line.extend_from_slice(br#""}"#);
        s.feed(&line);
        assert!(s.ok);
        assert_eq!(s.report_text(), "caf\u{fffd}");
    }

    #[test]
    fn the_last_assistant_text_stands_in_when_the_result_has_none() {
        let s = summary(&[json!({
            "type": "assistant",
            "message": { "id": "a", "content": [{ "type": "text", "text": "partial report" }] },
        })]);
        assert!(!s.saw_result);
        assert_eq!(s.report_text(), "partial report");
    }
}
