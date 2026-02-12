import type { Project } from "../../models/types.js";
import type { SiteConnector } from "./types.js";
import { GitHubSiteConnector } from "./github.js";
import { FilesystemSiteConnector } from "./filesystem.js";

/**
 * Create the appropriate SiteConnector based on project config.
 *
 * Each connector implements the universal SiteConnector interface:
 *   createReader() → for syncing
 *   write()        → deliver content
 *   publish()      → make content live (optional)
 */
export function createSiteConnector(project: Project): SiteConnector {
  const config = project.connector;

  switch (config.type) {
    case "github": {
      const gh = config.github;
      if (!gh) throw new Error("GitHub connector config missing");
      return new GitHubSiteConnector({
        installationId: gh.installationId,
        owner: gh.owner,
        repo: gh.repo,
        branch: gh.branch,
        contentPath: gh.contentPath,
        assetsPath: gh.assetsPath,
      });
    }

    case "git": {
      // Git without GitHub App → use filesystem for now
      // Future: GitSiteConnector with SSH keys
      const outputDir = config.filesystem?.outputDir ?? "/tmp/flowboost-output";
      return new FilesystemSiteConnector(outputDir);
    }

    case "filesystem": {
      const outputDir = config.filesystem?.outputDir;
      if (!outputDir) throw new Error("Filesystem connector requires outputDir");
      return new FilesystemSiteConnector(outputDir);
    }

    // Future connectors:
    // case "wordpress": return new WordPressSiteConnector(config.wordpress);
    // case "shopify":   return new ShopifySiteConnector(config.shopify);
    // case "webflow":   return new WebflowSiteConnector(config.webflow);

    default:
      throw new Error(`Unknown connector type: ${config.type}`);
  }
}
