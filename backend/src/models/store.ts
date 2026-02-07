import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../utils/logger.js";

const log = createLogger("store");

export class Store<T extends { id: string }> {
  constructor(
    private basePath: string,
    private fileName: string = "entity.json",
  ) {
    fs.mkdirSync(basePath, { recursive: true });
  }

  create(data: Omit<T, "id">): T {
    const id = crypto.randomUUID();
    const entity = { id, ...data } as T;
    const dir = path.join(this.basePath, id);
    fs.mkdirSync(dir, { recursive: true });
    this.writeJson(path.join(dir, this.fileName), entity);
    log.debug({ id }, "created entity");
    return entity;
  }

  get(id: string): T | null {
    const filePath = path.join(this.basePath, id, this.fileName);
    if (!fs.existsSync(filePath)) return null;
    return this.readJson(filePath);
  }

  list(): T[] {
    if (!fs.existsSync(this.basePath)) return [];
    const dirs = fs.readdirSync(this.basePath, { withFileTypes: true });
    return dirs
      .filter((d) => d.isDirectory())
      .map((d) => this.get(d.name))
      .filter((e): e is T => e !== null);
  }

  update(id: string, data: Partial<T>): T | null {
    const existing = this.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, id } as T;
    const filePath = path.join(this.basePath, id, this.fileName);
    this.writeJson(filePath, updated);
    log.debug({ id }, "updated entity");
    return updated;
  }

  delete(id: string): boolean {
    const dir = path.join(this.basePath, id);
    if (!fs.existsSync(dir)) return false;
    fs.rmSync(dir, { recursive: true });
    log.debug({ id }, "deleted entity");
    return true;
  }

  /** Read an arbitrary JSON file within an entity directory */
  readFile<U>(id: string, fileName: string): U | null {
    const filePath = path.join(this.basePath, id, fileName);
    if (!fs.existsSync(filePath)) return null;
    return this.readJson(filePath);
  }

  /** Write an arbitrary JSON file within an entity directory */
  writeFile<U>(id: string, fileName: string, data: U): void {
    const dir = path.join(this.basePath, id);
    fs.mkdirSync(dir, { recursive: true });
    this.writeJson(path.join(dir, fileName), data);
  }

  /** Read a text file within an entity directory */
  readTextFile(id: string, fileName: string): string | null {
    const filePath = path.join(this.basePath, id, fileName);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf-8");
  }

  /** Get the directory path for an entity */
  entityDir(id: string): string {
    return path.join(this.basePath, id);
  }

  private readJson<U>(filePath: string): U {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  private writeJson<U>(filePath: string, data: U): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  }
}
