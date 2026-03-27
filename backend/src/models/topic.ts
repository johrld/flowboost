import fs from "node:fs";
import path from "node:path";
import { Store } from "./store.js";
import { createLogger } from "../utils/logger.js";
import type { Topic, FlowInput, ProcessedInputData, ChatDistillation } from "./types.js";

const log = createLogger("topic-store");

export class TopicStore extends Store<Topic> {
  constructor(basePath: string) {
    super(basePath, "topic.json");
  }

  // ── Input Management ───────────────────────────────────

  /** Get the inputs directory for a topic */
  inputsDir(topicId: string): string {
    return path.join(this.entityDir(topicId), "inputs");
  }

  /** Add a text/URL input (no file upload) */
  addInput(topicId: string, input: Omit<FlowInput, "id" | "createdAt">): FlowInput | null {
    const topic = this.get(topicId);
    if (!topic) return null;

    const entry: FlowInput = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };

    const inputs = topic.inputs ?? [];
    inputs.push(entry);
    this.update(topicId, { inputs } as Partial<Topic>);

    log.debug({ topicId, inputId: entry.id, type: entry.type }, "input added");
    return entry;
  }

  /** Add a file input — stores file on disk and adds metadata to topic */
  addFileInput(
    topicId: string,
    file: { buffer: Buffer; fileName: string; mimeType: string },
    type: FlowInput["type"] = "document",
  ): FlowInput | null {
    const topic = this.get(topicId);
    if (!topic) return null;

    const inputId = crypto.randomUUID();
    const ext = path.extname(file.fileName) || "";
    const diskName = `${inputId}${ext}`;
    const dir = this.inputsDir(topicId);

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, diskName), file.buffer);

    const entry: FlowInput = {
      id: inputId,
      type,
      content: `inputs/${diskName}`,
      fileName: file.fileName,
      mimeType: file.mimeType,
      createdAt: new Date().toISOString(),
    };

    const inputs = topic.inputs ?? [];
    inputs.push(entry);
    this.update(topicId, { inputs } as Partial<Topic>);

    log.debug({ topicId, inputId, fileName: file.fileName }, "file input added");
    return entry;
  }

  /** Remove an input (and its file if applicable) */
  removeInput(topicId: string, inputId: string): boolean {
    const topic = this.get(topicId);
    if (!topic) return false;

    const inputs = topic.inputs ?? [];
    const input = inputs.find((i) => i.id === inputId);
    if (!input) return false;

    // Delete file from disk if it's a file reference
    if (input.content.startsWith("inputs/")) {
      const filePath = path.join(this.entityDir(topicId), input.content);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    const filtered = inputs.filter((i) => i.id !== inputId);
    this.update(topicId, { inputs: filtered } as Partial<Topic>);

    log.debug({ topicId, inputId }, "input removed");
    return true;
  }

  /** Get file path on disk for a file input */
  getInputFilePath(topicId: string, inputId: string): string | null {
    const topic = this.get(topicId);
    if (!topic) return null;

    const input = (topic.inputs ?? []).find((i) => i.id === inputId);
    if (!input || !input.content.startsWith("inputs/")) return null;

    const filePath = path.join(this.entityDir(topicId), input.content);
    return fs.existsSync(filePath) ? filePath : null;
  }

  // ── Processing Status ─────────────────────────────────

  /** Update the processed data for a specific input */
  updateInputProcessed(topicId: string, inputId: string, processed: ProcessedInputData): boolean {
    const topic = this.get(topicId);
    if (!topic) return false;

    const inputs = topic.inputs ?? [];
    const input = inputs.find((i) => i.id === inputId);
    if (!input) return false;

    input.processed = processed;
    this.update(topicId, { inputs } as Partial<Topic>);
    log.debug({ topicId, inputId, status: processed.status }, "input processing updated");
    return true;
  }

  /** Update chat distillation for a topic */
  updateChatDistillation(topicId: string, distillation: ChatDistillation): boolean {
    const topic = this.get(topicId);
    if (!topic) return false;
    this.update(topicId, { chatDistillation: distillation } as Partial<Topic>);
    log.debug({ topicId }, "chat distillation updated");
    return true;
  }

  // ── Output Management ──────────────────────────────────

  /** Add a content item ID to the output list */
  addOutput(topicId: string, contentItemId: string): boolean {
    const topic = this.get(topicId);
    if (!topic) return false;

    const outputIds = topic.outputIds ?? [];
    if (outputIds.includes(contentItemId)) return true;

    outputIds.push(contentItemId);
    this.update(topicId, { outputIds } as Partial<Topic>);

    log.debug({ topicId, contentItemId }, "output added");
    return true;
  }

  /** Remove a content item ID from the output list */
  removeOutput(topicId: string, contentItemId: string): boolean {
    const topic = this.get(topicId);
    if (!topic) return false;

    const outputIds = (topic.outputIds ?? []).filter((id) => id !== contentItemId);
    this.update(topicId, { outputIds } as Partial<Topic>);
    return true;
  }
}

export function createTopicStore(dataDir: string, customerId: string, projectId: string): TopicStore {
  return new TopicStore(path.join(dataDir, "customers", customerId, "projects", projectId, "topics"));
}
