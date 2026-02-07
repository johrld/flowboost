import type { Article, ArticleVersion, Project } from "../models/types.js";

export interface DeliveryResult {
  success: boolean;
  connector: string;
  filesWritten: string[];
  commitHash?: string;
  error?: string;
}

export interface DeliveryConnector {
  readonly name: string;

  /**
   * Deliver an approved article (all language versions) to the target.
   * For git: clone → write files → commit → push.
   * For filesystem: copy files to output directory.
   */
  deliver(
    project: Project,
    article: Article,
    versions: ArticleVersion[],
    versionDir: string,
  ): Promise<DeliveryResult>;
}
