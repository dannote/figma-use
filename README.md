# figma-use

Control Figma from the command line. Like [browser-use](https://github.com/browser-use/browser-use), but for Figma.

Built for AI agents to create and manipulate Figma designs programmatically.

## Why not the official Figma MCP?

The [official Figma MCP server](https://developers.figma.com/docs/figma-mcp-server/) is **read-only** — it can extract design context and take screenshots, but cannot create or modify anything.

| Feature | Official MCP | figma-use |
|---------|-------------|-----------|
| Read node properties | ✓ | ✓ |
| Take screenshots | ✓ | ✓ |
| Extract variables/styles | ✓ | ✓ |
| **Create shapes** | ✗ | ✓ |
| **Create text** | ✗ | ✓ |
| **Create frames & components** | ✗ | ✓ |
| **Modify properties** | ✗ | ✓ |
| **Set fills, strokes, effects** | ✗ | ✓ |
| **Auto-layout** | ✗ | ✓ |
| **Execute arbitrary code** | ✗ | ✓ |

figma-use gives AI agents full control over Figma — not just reading, but **creating and editing** designs.

## How it works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   AI Agent /    │────▶│   figma-use     │────▶│     Figma       │
│   CLI           │ HTTP│   proxy         │ WS  │     Plugin      │
│                 │◀────│   :38451        │◀────│                 │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

The CLI sends commands to a local proxy server, which forwards them via WebSocket to a Figma plugin. The plugin executes commands using the Figma API and returns results.

## Installation

```bash
bun install -g @dannote/figma-use
```

## Quick Start

### 1. Start the proxy server

```bash
figma-use proxy
```

### 2. Install the Figma plugin

```bash
# Quit Figma first, then:
figma-use plugin

# Or force install while Figma is running (restart required):
figma-use plugin --force

# Show plugin path only:
figma-use plugin --path

# Uninstall:
figma-use plugin --uninstall
```

Start Figma and find the plugin in **Plugins → Development → Figma Use**.

### 3. Run commands

```bash
# Create a styled button in one command (fill + stroke + radius + layout)
figma-use create-frame --x 0 --y 0 --width 200 --height 48 \
  --fill "#3B82F6" --stroke "#1D4ED8" --radius 8 \
  --layoutMode HORIZONTAL --itemSpacing 8 --padding "12,24,12,24" \
  --name "Button"

# Add text with font styling
figma-use create-text --x 0 --y 0 --text "Click me" \
  --fontSize 16 --fontFamily "Inter" --fontStyle "Medium" --fill "#FFFFFF" \
  --parentId "1:23"

# Export to PNG
figma-use export-node --id "1:23" --format PNG --scale 2 --output button.png
```

All create commands support inline styling — no need for separate `set-*` calls.

## Output Format

Human-readable by default:

```bash
$ figma-use create-rectangle --x 0 --y 0 --width 100 --height 50 --fill "#FF0000"
✓ Created rect "Rectangle"
  id: 1:23
  box: 100x50 at (0, 0)
  fill: #FF0000

$ figma-use get-children --id "1:2"
[0] frame "Header" (1:3)
    box: 1200x80 at (0, 0)
    fill: #FFFFFF

[1] text "Title" (1:4)
    box: 200x32 at (20, 24)
    font: 24px
```

Add `--json` for machine-readable output:

```bash
$ figma-use get-node --id "1:2" --json
{
  "id": "1:2",
  "name": "Frame",
  "type": "FRAME",
  ...
}
```

## Commands

### Shapes

| Command | Description |
|---------|-------------|
| `create-rectangle` | Create rectangle with optional fill, stroke, radius |
| `create-ellipse` | Create ellipse/circle |
| `create-line` | Create line |
| `create-polygon` | Create polygon |
| `create-star` | Create star |
| `create-vector` | Create vector path |

### Containers

| Command | Description |
|---------|-------------|
| `create-frame` | Create frame with optional auto-layout |
| `create-component` | Create component |
| `create-instance` | Create component instance |
| `create-section` | Create section |
| `group-nodes` | Group nodes |
| `ungroup-node` | Ungroup |

### Text

| Command | Description |
|---------|-------------|
| `create-text` | Create text with font, size, color |
| `set-text` | Update text content |
| `set-font` | Change font family, size, weight |
| `set-text-properties` | Line height, letter spacing, alignment |

### Styling

| Command | Description |
|---------|-------------|
| `set-fill-color` | Set fill color |
| `set-stroke-color` | Set stroke color and weight |
| `set-corner-radius` | Set corner radius (uniform or individual) |
| `set-opacity` | Set opacity |
| `set-effect` | Add shadow or blur |
| `set-blend-mode` | Set blend mode |

### Layout

| Command | Description |
|---------|-------------|
| `set-layout` | Enable auto-layout (horizontal/vertical) |
| `set-layout-child` | Set child sizing (fill/fixed/hug) |
| `set-constraints` | Set resize constraints |
| `set-min-max` | Set min/max width/height |

### Transform

| Command | Description |
|---------|-------------|
| `move-node` | Move to x, y |
| `resize-node` | Resize to width, height |
| `set-rotation` | Rotate by angle |
| `set-parent` | Move to different parent |

### Export

| Command | Description |
|---------|-------------|
| `export-node` | Export node as PNG/SVG/PDF |
| `screenshot` | Screenshot current viewport |

### Query

| Command | Description |
|---------|-------------|
| `get-node` | Get node properties |
| `get-children` | Get child nodes |
| `get-selection` | Get selected nodes |
| `get-pages` | List all pages |
| `find-by-name` | Find nodes by name |

### Navigation

| Command | Description |
|---------|-------------|
| `set-current-page` | Switch to page |
| `zoom-to-fit` | Zoom to fit nodes |
| `set-viewport` | Set viewport position and zoom |

### Advanced

| Command | Description |
|---------|-------------|
| `eval` | Execute arbitrary JavaScript in Figma |

#### eval

Run any JavaScript code in the Figma plugin context:

```bash
# Simple expression
figma-use eval "return 2 + 2"

# Access Figma API
figma-use eval "return figma.currentPage.name"

# Create nodes
figma-use eval "const r = figma.createRectangle(); r.resize(100, 100); return r.id"

# Async code (top-level await supported)
figma-use eval "const node = await figma.getNodeByIdAsync('1:2'); return node.name"
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 38451 | Proxy server port |
| `FIGMA_PROXY_URL` | `http://localhost:38451` | Proxy URL for CLI |

## For AI Agents

figma-use is designed to work with AI coding agents like [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Cursor](https://cursor.sh), or any agent that can execute shell commands.

### Using with Claude Code

Add the [web-to-figma skill](https://github.com/anthropics/claude-code/tree/main/skills) to your agent:

```bash
# The skill teaches the agent how to:
# - Extract styles from web pages
# - Recreate UI components in Figma
# - Match colors, fonts, spacing, and layout
```

Then just ask:

```
Recreate this login form in Figma: https://example.com/login
```

The agent will use `figma-use` commands to build the design.

## License

MIT
