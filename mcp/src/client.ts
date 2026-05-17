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

export class XctApiClient {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  private async apiFetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API error ${response.status} ${response.statusText}: ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  async listModels(): Promise<ModelsListResponse> {
    return this.apiFetch<ModelsListResponse>("/v1/models");
  }

  async chatCompletion(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    return this.apiFetch<ChatCompletionResponse>("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ ...request, stream: false }),
    });
  }

  async imageGeneration(
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResponse> {
    return this.apiFetch<ImageGenerationResponse>("/v1/images/generations", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getTokenUsage(): Promise<TokenUsageResponse> {
    return this.apiFetch<TokenUsageResponse>("/api/usage/token");
  }
}
