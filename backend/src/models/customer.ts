import path from "node:path";
import { Store } from "./store.js";
import type { Customer } from "./types.js";

export class CustomerStore extends Store<Customer> {
  constructor(dataDir: string) {
    super(path.join(dataDir, "customers"), "customer.json");
  }

  getBrandVoice(customerId: string): string | null {
    return this.readTextFile(customerId, "brand-voice.md");
  }

  saveBrandVoice(customerId: string, content: string): void {
    this.writeTextFile(customerId, "brand-voice.md", content);
  }

  getStyleGuide(customerId: string): string | null {
    return this.readTextFile(customerId, "style-guide.md");
  }
}
