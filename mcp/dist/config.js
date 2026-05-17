"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
function loadConfig() {
    const apiKey = process.env.XCT_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
    const baseUrl = (process.env.XCT_BASE_URL ??
        process.env.OPENAI_BASE_URL ??
        "https://api.xct.ai").replace(/\/$/, "");
    if (!apiKey) {
        process.stderr.write("Warning: XCT_API_KEY is not set. Set it via the XCT_API_KEY environment variable.\n");
    }
    return { apiKey, baseUrl };
}
//# sourceMappingURL=config.js.map