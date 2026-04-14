import { Store } from "./store.js";

export interface Idea {
  id: string;
  title: string;
  description?: string;
  labels: string[]; // "article", "linkedin", "instagram", "x", "tiktok", "newsletter"
  attachments: IdeaAttachment[];
  status: "inbox" | "planned" | "done" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface IdeaAttachment {
  id: string;
  type: "link" | "image" | "video" | "file" | "note";
  url?: string;
  fileName?: string;
  content?: string;
  createdAt: string;
}

export class IdeaStore extends Store<Idea> {
  constructor(basePath: string) {
    super(basePath, "idea.json");
  }

  listByStatus(status: Idea["status"]): Idea[] {
    return this.list().filter((i) => i.status === status);
  }

  listInbox(): Idea[] {
    return this.listByStatus("inbox");
  }
}
