import path from "node:path";
import { Store } from "./store.js";
import type { Topic } from "./types.js";

export class TopicStore extends Store<Topic> {
  constructor(basePath: string) {
    super(basePath, "topic.json");
  }
}

export function createTopicStore(dataDir: string, customerId: string, projectId: string): TopicStore {
  return new TopicStore(path.join(dataDir, "customers", customerId, "projects", projectId, "topics"));
}
