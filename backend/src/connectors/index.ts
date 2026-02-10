import type { Project } from "../models/types.js";
import type { DeliveryConnector } from "./types.js";
import { FilesystemConnector } from "./filesystem.js";
import { GitConnector } from "./git.js";

/**
 * Create the appropriate delivery connector based on project config.
 */
export function createConnector(project: Project): DeliveryConnector {
  switch (project.connector.type) {
    case "git":
      return new GitConnector();

    case "github":
      return new GitConnector();

    case "filesystem":
      if (!project.connector.filesystem?.outputDir) {
        throw new Error("Filesystem connector requires outputDir");
      }
      return new FilesystemConnector(project.connector.filesystem.outputDir);

    default:
      throw new Error(`Unknown connector type: ${project.connector.type}`);
  }
}
