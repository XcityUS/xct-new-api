#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_js_1 = require("./server.js");
(0, server_js_1.createServer)().catch((err) => {
    process.stderr.write(`Fatal: ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map