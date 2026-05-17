import { Config } from "./config.js";
export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
export interface ChatCompletionRequest {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
}
export interface ChatCompletionResponse {
    id: string;
    object: string;
    model: string;
    choices: Array<{
        index: number;
        message: ChatMessage;
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export interface ImageGenerationRequest {
    model?: string;
    prompt: string;
    n?: number;
    size?: string;
    response_format?: "url" | "b64_json";
}
export interface ImageGenerationResponse {
    created: number;
    data: Array<{
        url?: string;
        b64_json?: string;
        revised_prompt?: string;
    }>;
}
export interface ModelObject {
    id: string;
    object: string;
    created: number;
    owned_by: string;
}
export interface ModelsListResponse {
    object: string;
    data: ModelObject[];
}
export interface TokenUsageData {
    object: string;
    name: string;
    total_granted: number;
    total_used: number;
    total_available: number;
    unlimited_quota: boolean;
    expires_at: number;
}
export interface TokenUsageResponse {
    code: boolean;
    message: string;
    data: TokenUsageData;
}
export declare class XctApiClient {
    private config;
    constructor(config: Config);
    private apiFetch;
    listModels(): Promise<ModelsListResponse>;
    chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    imageGeneration(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;
    getTokenUsage(): Promise<TokenUsageResponse>;
}
//# sourceMappingURL=client.d.ts.map