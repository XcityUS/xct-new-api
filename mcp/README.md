# xct-new-api-mcp

MCP (Model Context Protocol) Server for [xct-new-api](https://github.com/XcityUS/xct-new-api).

Exposes 300+ AI models to any MCP-compatible client — Cursor, Claude Desktop, Windsurf, VS Code Copilot, and more.

## Features

| Tool | Description |
|------|-------------|
| `list_models` | List all available models, with optional substring filter |
| `chat_completion` | Chat with any model (GPT-4o, Claude, Gemini, Llama, etc.) |
| `image_generation` | Generate images via DALL-E 3, Stable Diffusion, Flux, etc. |
| `get_balance` | Check your API token's remaining quota and usage |

## Quick Start

```bash
npx -y xct-new-api-mcp
```

Set your API key via the `XCT_API_KEY` environment variable before running.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `XCT_API_KEY` | Your xct-new-api API key (required) | — |
| `XCT_BASE_URL` | API base URL | `https://api.xct.ai` |
| `OPENAI_API_KEY` | Fallback if `XCT_API_KEY` is not set | — |
| `OPENAI_BASE_URL` | Fallback if `XCT_BASE_URL` is not set | — |

API keys are created in the xct-new-api dashboard under **Tokens**.

---

## Client Setup

### Cursor

Add to `~/.cursor/mcp.json` (or your project's `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "xct-new-api": {
      "command": "npx",
      "args": ["-y", "xct-new-api-mcp"],
      "env": {
        "XCT_API_KEY": "sk-your-api-key-here"
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "xct-new-api": {
      "command": "npx",
      "args": ["-y", "xct-new-api-mcp"],
      "env": {
        "XCT_API_KEY": "sk-your-api-key-here"
      }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "xct-new-api": {
      "command": "npx",
      "args": ["-y", "xct-new-api-mcp"],
      "env": {
        "XCT_API_KEY": "sk-your-api-key-here"
      }
    }
  }
}
```

### VS Code (Copilot / MCP extension)

Add to `.vscode/mcp.json` in your workspace, or to your user `settings.json` under `"mcp"`:

```json
{
  "servers": {
    "xct-new-api": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "xct-new-api-mcp"],
      "env": {
        "XCT_API_KEY": "sk-your-api-key-here"
      }
    }
  }
}
```

---

## Self-Hosted Instance

If you run your own xct-new-api instance, set the base URL:

```json
{
  "mcpServers": {
    "xct-new-api": {
      "command": "npx",
      "args": ["-y", "xct-new-api-mcp"],
      "env": {
        "XCT_API_KEY": "sk-your-api-key-here",
        "XCT_BASE_URL": "https://your-instance.example.com"
      }
    }
  }
}
```

---

## Tool Reference

### `list_models`

Lists all models available on your xct-new-api instance.

**Parameters:**
- `filter` (optional, string) — only return models whose ID contains this string

**Example prompt:** *"List all available GPT models"*

---

### `chat_completion`

Sends a chat completion request to any available model.

**Parameters:**
- `model` (required, string) — model ID, e.g. `gpt-4o`, `claude-3-5-sonnet-20241022`
- `messages` (required, array) — array of `{role, content}` objects
- `temperature` (optional, number) — sampling temperature 0–2
- `max_tokens` (optional, integer) — maximum tokens to generate

**Example prompt:** *"Using claude-3-5-sonnet, explain how MCP works in two sentences"*

---

### `image_generation`

Generates images from a text prompt.

**Parameters:**
- `prompt` (required, string) — description of the image
- `model` (optional, string) — image model ID (default: `dall-e-3`)
- `n` (optional, integer) — number of images 1–10 (default: 1)
- `size` (optional, string) — image dimensions (default: `1024x1024`)

**Example prompt:** *"Generate an image of a futuristic city at sunset"*

---

### `get_balance`

Returns the remaining quota, total granted quota, and expiry for your API token.

**Example prompt:** *"How much quota do I have left?"*

---

## Development

```bash
# Clone the repo
git clone https://github.com/XcityUS/xct-new-api.git
cd xct-new-api/mcp

# Install dependencies
npm install

# Run in dev mode (no build step)
XCT_API_KEY=sk-xxx npm run dev

# Build
npm run build
```

## License

MIT
