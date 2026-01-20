# MCP Server

figma-use includes an MCP (Model Context Protocol) server with 90+ tools for AI agents.

## Quick Start

```bash
# Terminal 1: Start Figma with debug port
open -a Figma --args --remote-debugging-port=9222

# Terminal 2: Start MCP server
figma-use mcp serve
```

## Configuration

Add to your MCP client config (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "figma-use": {
      "url": "http://localhost:38451/mcp"
    }
  }
}
```

## Available Tools

All CLI commands are exposed as MCP tools with `figma_` prefix:

| Tool | Description |
|------|-------------|
| `figma_status` | Check if Figma is connected |
| `figma_create_frame` | Create a frame with layout |
| `figma_create_rect` | Create a rectangle |
| `figma_create_text` | Create text node |
| `figma_create_icon` | Insert Iconify icon |
| `figma_set_fill` | Set fill color |
| `figma_set_layout` | Set auto-layout or grid |
| `figma_node_move` | Move node |
| `figma_node_resize` | Resize node |
| `figma_export_node` | Export node as PNG/SVG |
| `figma_render` | Render JSX to Figma |
| `figma_query` | Find nodes via XPath |
| ... | 80+ more tools |

## Example Usage

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "figma_create_frame",
    "arguments": {
      "width": "400",
      "height": "300",
      "fill": "#FFFFFF",
      "layout": "VERTICAL",
      "gap": "16"
    }
  }
}
```

## Render Tool

The `figma_render` tool accepts JSX:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "figma_render",
    "arguments": {
      "jsx": "<Frame style={{p: 24, bg: '#3B82F6', rounded: 12}}><Text style={{size: 18, color: '#FFF'}}>Hello</Text></Frame>",
      "x": "100",
      "y": "200"
    }
  }
}
```

## Custom Port

```bash
figma-use mcp serve --port 8080
```
