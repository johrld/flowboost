import type { ConnectorInstance, ConnectorType, Project } from "../../models/types.js";
import { findConnector, findConnectorById, getSiteConnector } from "../../models/types.js";
import type { SiteConnector } from "./types.js";
import { GitHubSiteConnector } from "./github.js";
import { FilesystemSiteConnector } from "./filesystem.js";
import { ShopwareSiteConnector } from "./shopware.js";
import { WordPressSiteConnector } from "./wordpress.js";

/**
 * Create a SiteConnector from the project's connectors array.
 *
 * Lookup order:
 *   1. By connectorId (if provided)
 *   2. By connectorType (if provided)
 *   3. Primary site connector (first site-capable connector)
 *   4. Fallback to V1 project.connector (migration compat)
 */
export function createSiteConnector(
  project: Project,
  opts?: { connectorId?: string; connectorType?: ConnectorType },
): SiteConnector {
  let instance: ConnectorInstance | undefined;

  if (opts?.connectorId) {
    instance = findConnectorById(project, opts.connectorId);
  } else if (opts?.connectorType) {
    instance = findConnector(project, opts.connectorType);
  } else {
    instance = getSiteConnector(project);
  }

  // V1 fallback
  if (!instance && project.connector?.type) {
    instance = { id: "v1-compat", ...project.connector };
  }

  if (!instance) throw new Error("No connector configured");

  return createFromInstance(instance);
}

function createFromInstance(config: ConnectorInstance): SiteConnector {
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

    default:
      throw new Error(`Unknown connector type: ${config.type}`);
  }
}
