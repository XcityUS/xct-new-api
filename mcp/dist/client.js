"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XctApiClient = void 0;
class XctApiClient {
    config;
    constructor(config) {
        this.config = config;
    }
    async apiFetch(path, options = {}) {
        const url = `${this.config.baseUrl}${path}`;
        const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
            ...options.headers,
        };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error ${response.status} ${response.statusText}: ${errorText}`);
        }
        return response.json();
    }
    async listModels() {
        return this.apiFetch("/v1/models");
    }
    async chatCompletion(request) {
        return this.apiFetch("/v1/chat/completions", {
            method: "POST",
            body: JSON.stringify({ ...request, stream: false }),
        });
    }
    async imageGeneration(request) {
        return this.apiFetch("/v1/images/generations", {
            method: "POST",
            body: JSON.stringify(request),
        });
    }
    async getTokenUsage() {
        return this.apiFetch("/api/usage/token");
    }
}
exports.XctApiClient = XctApiClient;
//# sourceMappingURL=client.js.map