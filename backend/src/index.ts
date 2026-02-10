import path from "node:path";
import { buildServer } from "./api/server.js";
import { createLogger } from "./utils/logger.js";

const log = createLogger("main");

const port = parseInt(process.env.PORT ?? "6100", 10);
const dataDir = path.resolve(process.env.DATA_DIR ?? "./data");

async function main() {
  const app = await buildServer(dataDir);

  await app.listen({ port, host: "0.0.0.0" });
  log.info({ port, dataDir }, "FlowBoost server started");
}

main().catch((err) => {
  log.fatal(err, "failed to start server");
  process.exit(1);
});
