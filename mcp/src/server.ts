import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { loadConfig } from "./config.js";
import { XctApiClient } from "./client.js";

const TOOLS: Tool[] = [
  {
    name: "list_models",
    description:
      "List all available AI models on xct-new-api. Returns model IDs you can use in other tools.",
    inputSchema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          description:
            "Optional substring filter — only models whose ID contains this string are returned.",
        },
      },
    },
  },
  {
    name: "chat_completion",
    description:
      "Send a chat completion request to any model available on xct-new-api (GPT-4, Claude, Gemini, Llama, etc.).",
    inputSchema: {
      type: "object",
      required: ["model", "messages"],
      properties: {
        model: {
          type: "string",
          description:
            "Model ID, e.g. gpt-4o, claude-3-5-sonnet-20241022, gemini-1.5-pro. Use list_models to see available options.",
        },
        messages: {
          type: "array",
          description: "Conversation messages.",
          items: {
            type: "object",
            required: ["role", "content"],
            properties: {
              role: {
                type: "string",
                enum: ["system", "user", "assistant"],
              },
              content: {
                type: "string",
              },
            },
          },
        },
        temperature: {
          type: "number",
          description: "Sampling temperature (0–2). Default is model-dependent.",
        },
        max_tokens: {
          type: "integer",
          description: "Maximum tokens to generate.",
        },
      },
    },
  },
  {
    name: "image_generation",
    description:
      "Generate images from a text prompt using DALL-E, Stable Diffusion, Flux, or other image models.",
    inputSchema: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: {
          type: "string",
          description: "Text description of the image to generate.",
        },
        model: {
          type: "string",
          description:
            "Image model ID, e.g. dall-e-3, dall-e-2, stable-diffusion-xl. Defaults to dall-e-3.",
        },
        n: {
          type: "integer",
          description: "Number of images to generate (1–10). Default is 1.",
          minimum: 1,
          maximum: 10,
        },
        size: {
          type: "string",
          description:
            "Image size, e.g. 1024x1024, 1792x1024, 1024x1792. Default is 1024x1024.",
        },
      },
    },
  },
  {
    name: "get_balance",
    description:
      "Query your API token's remaining quota, total granted quota, and usage statistics.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

export async function createServer(): Promise<void> {
  const config = loadConfig();
  const client = new XctApiClient(config);

  const server = new Server(
    {
      name: "xct-new-api-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        case "list_models": {
          const result = await client.listModels();
          let models = result.data ?? [];
          const filter = args.filter as string | undefined;
          if (filter) {
            models = models.filter((m) =>
              m.id.toLowerCase().includes(filter.toLowerCase())
            );
          }
          const modelList = models
            .map((m) => `- ${m.id}`)
            .join("\n");
          return {
            content: [
              {
                type: "text",
                text: `Found ${models.length} models${filter ? ` matching "${filter}"` : ""}:\n\n${modelList}`,
              },
            ],
          };
        }

        case "chat_completion": {
          const { model, messages, temperature, max_tokens } = args as {
            model: string;
            messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
            temperature?: number;
            max_tokens?: number;
          };

          const result = await client.chatCompletion({
            model,
            messages,
            temperature,
            max_tokens,
          });

          const choice = result.choices?.[0];
          const content = choice?.message?.content ?? "";
          const usage = result.usage;

          let text = content;
          if (usage) {
            text += `\n\n---\n*Model: ${result.model} | Tokens: ${usage.prompt_tokens} prompt + ${usage.completion_tokens} completion = ${usage.total_tokens} total*`;
          }

          return {
            content: [{ type: "text", text }],
          };
        }

        case "image_generation": {
          const { prompt, model, n, size } = args as {
            prompt: string;
            model?: string;
            n?: number;
            size?: string;
          };

          const result = await client.imageGeneration({
            prompt,
            model: model ?? "dall-e-3",
            n: n ?? 1,
            size: size ?? "1024x1024",
            response_format: "url",
          });

          const images = result.data ?? [];
          const lines = images.map((img, i) => {
            const parts: string[] = [];
            if (img.revised_prompt) {
              parts.push(`Revised prompt: ${img.revised_prompt}`);
            }
            if (img.url) {
              parts.push(`Image ${i + 1}: ${img.url}`);
            }
            return parts.join("\n");
          });

          return {
            content: [
              {
                type: "text",
                text:
                  lines.length > 0
                    ? lines.join("\n\n")
                    : "No images were returned.",
              },
            ],
          };
        }

        case "get_balance": {
          const result = await client.getTokenUsage();
          const d = result.data;

          if (d.unlimited_quota) {
            return {
              content: [
                {
                  type: "text",
                  text: `Token: **${d.name}**\nQuota: **Unlimited**\nUsed: ${d.total_used} units`,
                },
              ],
            };
          }

          const expiresStr =
            d.expires_at > 0
              ? new Date(d.expires_at * 1000).toISOString()
              : "Never";

          return {
            content: [
              {
                type: "text",
                text: [
                  `Token: **${d.name}**`,
                  `Total granted: ${d.total_granted}`,
                  `Used: ${d.total_used}`,
                  `Remaining: ${d.total_available}`,
                  `Expires: ${expiresStr}`,
                ].join("\n"),
              },
            ],
          };
        }

        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
