import { createLogger } from "../utils/logger.js";

const log = createLogger("extract-json");

/**
 * Extract JSON from LLM agent output text.
 *
 * Tries four strategies in order:
 * 1. Markdown code block (last block wins — agents often correct themselves)
 * 2. Direct JSON.parse on trimmed text
 * 3. Bracket-matching to isolate the JSON object/array from surrounding prose
 * 4. Truncation repair (close unclosed brackets, remove trailing fragments)
 */
export function extractJson<T>(text: string): T {
  // Strategy 1: Extract from markdown code block (last JSON block wins)
  const codeBlock = extractLastCodeBlock(text);
  if (codeBlock) {
    try {
      return JSON.parse(codeBlock) as T;
    } catch { /* fall through */ }
  }

  // Strategy 2: Direct parse (input is already pure JSON)
  try {
    return JSON.parse(text.trim()) as T;
  } catch { /* fall through */ }

  // Strategy 3: Bracket-matching — find balanced {..} or [..] with string awareness
  const matched = matchBalancedJson(text);
  if (matched) {
    try {
      return JSON.parse(matched) as T;
    } catch { /* fall through */ }
  }

  // Strategy 4: Repair truncated JSON (last resort)
  log.warn({ inputLength: text.length, preview: text.slice(0, 300) }, "primary extraction failed, attempting truncation repair");
  const repaired = repairTruncatedJson(text);
  if (repaired) {
    try {
      return JSON.parse(repaired) as T;
    } catch { /* fall through */ }
  }

  log.error({ inputLength: text.length, preview: text.slice(0, 500) }, "all JSON extraction strategies failed");
  throw new Error("Could not extract JSON from agent output");
}

/**
 * Extract the last markdown code block that looks like JSON.
 * Last block wins because agents often correct themselves.
 */
function extractLastCodeBlock(text: string): string | null {
  const regex = /```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?\s*```/gi;
  let lastMatch: string | null = null;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const content = match[1].trim();
    if (/^\s*[{\[]/.test(content)) {
      lastMatch = content;
    }
  }

  return lastMatch;
}

/**
 * Find a balanced JSON object or array in the text using bracket-matching.
 * Handles string escaping correctly — stops at the matching closing brace.
 */
function matchBalancedJson(text: string): string | null {
  const start = text.search(/[{\[]/);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === "{" || ch === "[") depth++;
    if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  // Unbalanced — return what we have (will likely fail parse, fall through to repair)
  return null;
}

/**
 * Attempt to repair truncated JSON by cleaning trailing fragments and closing brackets.
 */
function repairTruncatedJson(text: string): string | null {
  const start = text.search(/[{\[]/);
  if (start === -1) return null;

  let json = text.slice(start);

  // Remove trailing incomplete string values
  json = json.replace(/,\s*"[^"]*$/, "");          // trailing key without value
  json = json.replace(/:\s*"[^"]*$/, ': ""');       // truncated string value
  json = json.replace(/,\s*$/, "");                  // trailing comma

  // Count open/close brackets and close them
  const closes: Record<string, string> = { "{": "}", "[": "]" };
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (const ch of json) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    if (ch === "}" || ch === "]") stack.pop();
  }

  while (stack.length > 0) {
    const open = stack.pop()!;
    json += closes[open];
  }

  return json;
}
