import type { Project } from "../../models/types.js";
import type { SiteConnector } from "./types.js";
import { GitHubSiteConnector } from "./github.js";
import { FilesystemSiteConnector } from "./filesystem.js";
import { ShopwareSiteConnector } from "./shopware.js";
import { WordPressSiteConnector } from "./wordpress.js";

/**
 * Create the appropriate SiteConnector based on project config.
 *
 * Each connector implements the universal SiteConnector interface:
 *   createReader() → for syncing
 *   write()        → deliver content
 *   publish()      → make content live (optional)
 *   discoverSchemas() → discover platform content structures (optional)
 *   writeStructured() → deliver slot-based content (optional)
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
      const outputDir = config.filesystem?.outputDir ?? "/tmp/flowboost-output";
      return new FilesystemSiteConnector(outputDir);
    }

    case "filesystem": {
      const outputDir = config.filesystem?.outputDir;
      if (!outputDir) throw new Error("Filesystem connector requires outputDir");
      return new FilesystemSiteConnector(outputDir);
    }

    case "shopware": {
      const sw = config.shopware;
      if (!sw) throw new Error("Shopware connector config missing");
      return new ShopwareSiteConnector({
        shopUrl: sw.shopUrl,
        clientId: sw.clientId,
        clientSecret: sw.clientSecret,
      });
    }

    case "wordpress": {
      const wp = config.wordpress;
      if (!wp) throw new Error("WordPress connector config missing");
      return new WordPressSiteConnector({
        siteUrl: wp.siteUrl,
        username: wp.username,
        applicationPassword: wp.applicationPassword,
      });
    }

    // Future connectors:
    // case "shopify":   return new ShopifySiteConnector(config.shopify);
    // case "webflow":   return new WebflowSiteConnector(config.webflow);

    default:
      throw new Error(`Unknown connector type: ${config.type}`);
  }
}
