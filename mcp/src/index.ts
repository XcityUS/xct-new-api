#!/usr/bin/env node
import { createServer } from "./server.js";

createServer().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
