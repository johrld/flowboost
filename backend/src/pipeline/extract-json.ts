/**
 * Extract JSON from LLM agent output text.
 * Handles markdown code blocks, truncated JSON, and messy output.
 */
export function extractJson<T>(text: string): T {
  // Try markdown code block first
  const match = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  const candidate = match ? match[1].trim() : text.trim();

  // Try direct parse
  try {
    const start = candidate.search(/[{[]/);
    if (start === -1) throw new Error("No JSON found");
    return JSON.parse(candidate.slice(start)) as T;
  } catch {
    // Try to repair truncated JSON by closing open brackets/braces
    const start = candidate.search(/[{[]/);
    if (start === -1) throw new Error("Could not extract JSON from agent output");
    let json = candidate.slice(start);

    // Remove trailing incomplete strings (e.g. cut off mid-value)
    json = json.replace(/,\s*"[^"]*$/, "");  // trailing key without value
    json = json.replace(/,\s*$/, "");          // trailing comma

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

    // Close unclosed brackets in reverse order
    while (stack.length > 0) {
      const open = stack.pop()!;
      json += closes[open];
    }

    try {
      return JSON.parse(json) as T;
    } catch {
      throw new Error("Could not extract JSON from agent output");
    }
  }
}
