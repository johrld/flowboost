import fs from "node:fs";
import path from "node:path";
import type { ChatMessage } from "./types.js";

const CHAT_FILE = "chat.jsonl";

/** Read all chat messages from a JSONL file in the given directory */
export function readChat(dir: string): ChatMessage[] {
  const filePath = path.join(dir, CHAT_FILE);
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf-8").trim();
  if (!content) return [];
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ChatMessage);
}

/** Append a single chat message to the JSONL file */
export function appendChat(dir: string, msg: ChatMessage): void {
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, CHAT_FILE);
  fs.appendFileSync(filePath, JSON.stringify(msg) + "\n", "utf-8");
}
