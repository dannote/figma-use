# figma-use

Control Figma from the command line. Built for AI agents to create and manipulate designs programmatically.

Inspired by [agent-browser](https://github.com/vercel-labs/agent-browser) (browser automation) and [bird](https://github.com/steipete/bird) (Twitter CLI) — fast CLIs that save tokens and give agents direct control.

## Why not the official Figma MCP?

The [official Figma MCP server](https://developers.figma.com/docs/figma-mcp-server/) is focused on **design-to-code** — extracting structure and variables for code generation. It cannot create or modify designs.

| Feature | Official MCP | figma-use |
|---------|-------------|-----------|
| Read node properties | ✓ | ✓ |
| Take screenshots | ✓ | ✓ |
| Extract variables | ✓ | ✓ |
| **Create shapes** | ✗ | ✓ |
| **Create text** | ✗ | ✓ |
| **Create frames & components** | ✗ | ✓ |
| **Modify properties** | ✗ | ✓ |
| **Set fills, strokes, effects** | ✗ | ✓ |
| **Auto-layout** | ✗ | ✓ |
| **Create/modify variables** | ✗ | ✓ |
| **Execute arbitrary code** | ✗ | ✓ |

figma-use gives AI agents **full read/write control** over Figma.

## How it works

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│   AI Agent /    │─────▶│   figma-use     │─────▶│     Figma       │
│   CLI           │ HTTP │   proxy         │  WS  │     Plugin      │
│                 │◀─────│   :38451        │◀─────│                 │
│                 │      │                 │      │                 │
└─────────────────┘      └────────┬────────┘      └─────────────────┘
                                  │
                                  │ WebSocket (persistent)
                                  ▼
                         ┌─────────────────┐
                         │     Figma       │
                         │   Multiplayer   │
                         │     Server      │
                         └─────────────────┘
```

Two communication paths:
- **Plugin API** — most commands go through the Figma plugin for full API access
- **Multiplayer WebSocket** — the `render` command writes directly to Figma's multiplayer server for ~100x faster node creation

The proxy maintains persistent connections for fast repeated operations.

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

# Or with options:
figma-use plugin --force      # Force install while Figma is running
figma-use plugin --path       # Show plugin path only
figma-use plugin --uninstall  # Uninstall
```

Start Figma and find the plugin in **Plugins → Development → Figma Use**.

### 3. Run commands

```bash
# Create a styled button
figma-use create frame --x 0 --y 0 --width 200 --height 48 \
  --fill "#3B82F6" --radius 8 \
  --layout HORIZONTAL --gap 8 --padding "12,24,12,24" \
  --name "Button"

# Add text
figma-use create text --x 0 --y 0 --text "Click me" \
  --fontSize 16 --fontFamily "Inter" --fontStyle "Medium" --fill "#FFFFFF" \
  --parent "1:23"

# Export to PNG
figma-use export node "1:23" --format PNG --scale 2 --output button.png
```

All create commands support inline styling — no need for separate `set` calls.

## Commands

### Node Operations

```bash
figma-use node get <id>                    # Get node properties
figma-use node tree [id]                   # Get formatted tree (default: current page)
figma-use node tree --depth 2              # Limit tree depth (also limits node count check)
figma-use node tree -i                     # Only interactive elements
figma-use node tree --force                # Skip 500 node limit
figma-use node children <id>               # Get child nodes
figma-use node delete <id>                 # Delete node
figma-use node clone <id>                  # Clone node
figma-use node rename <id> <name>          # Rename node
figma-use node move <id> --x <x> --y <y>   # Move node
figma-use node resize <id> --width <w> --height <h>
```

The `tree` command outputs a human-readable hierarchy:

```
[0] frame "Card" (1:23)
    400×300 at (0, 0) | fill: #FFFFFF | layout: col gap=16
  [0] text "Title" (1:24)
      200×32 at (24, 24) | fill: #000000 | "Hello World" | font: 24px Inter Bold
  [1] frame "Content" (1:25)
      352×200 at (24, 72) | fill: #F5F5F5 | radius: 8
```

### Create Shapes

```bash
figma-use create rect --x 0 --y 0 --width 100 --height 50 [--fill --stroke --radius]
figma-use create ellipse --x 0 --y 0 --width 100 --height 100 [--fill]
figma-use create line --x 0 --y 0 --length 100 [--stroke]
figma-use create polygon --x 0 --y 0 --size 60 --sides 6 [--fill]
figma-use create star --x 0 --y 0 --size 60 --points 5 [--fill]
figma-use create vector --x 0 --y 0 --path "M0,0 L100,100"
```

### Create Containers

```bash
figma-use create frame --x 0 --y 0 --width 400 --height 300 \
  [--fill --radius --layout HORIZONTAL --gap 12 --padding "16,16,16,16"]
figma-use create component --x 0 --y 0 --width 200 --height 100
figma-use create instance --component <id> --x 100 --y 100
figma-use create section --x 0 --y 0 --width 800 --height 600 --name "Hero"
figma-use create page "Page Name"
```

### Create Text

```bash
figma-use create text --x 0 --y 0 --text "Hello" \
  [--fontSize 24 --fontFamily "Inter" --fontStyle "Bold" --fill "#000"]
```

### Set Properties

```bash
figma-use set fill <id> "#FF0000"
figma-use set stroke <id> "#000" [--weight 2]
figma-use set radius <id> --radius 12
figma-use set radius <id> --topLeft 16 --bottomRight 16
figma-use set opacity <id> 0.5
figma-use set rotation <id> 45
figma-use set visible <id> false
figma-use set text <id> "New text"
figma-use set font <id> --family "Inter" --style "Bold" --size 20
figma-use set effect <id> --type DROP_SHADOW --radius 10 --offsetY 4 --color "#00000040"
figma-use set layout <id> --mode VERTICAL --gap 12 --padding 16
figma-use set blend <id> MULTIPLY
figma-use set constraints <id> --horizontal CENTER --vertical MAX
figma-use set image <id> image.png [--mode FILL]
```

### Variables (Design Tokens)

```bash
figma-use variable list [--type COLOR|FLOAT|STRING|BOOLEAN]
figma-use variable get <id>
figma-use variable create "Primary" --collection <id> --type COLOR --value "#FF0000"
figma-use variable set <id> --mode <modeId> --value "#00FF00"
figma-use variable delete <id>
figma-use variable bind --node <nodeId> --field fills --variable <varId>

figma-use collection list
figma-use collection get <id>
figma-use collection create "Colors"
figma-use collection delete <id>
```

### Styles

```bash
figma-use style list
figma-use style create-paint "Brand/Primary" --color "#E11D48"
figma-use style create-text "Heading/H1" --family "Inter" --style "Bold" --size 32
figma-use style create-effect "Shadow/Medium" --type DROP_SHADOW --radius 8 --offsetY 4
```

### Export

```bash
figma-use export node <id> [--format PNG|SVG|PDF] [--scale 2] [--output file.png]
figma-use export selection [--format PNG] [--scale 2] [--output file.png]
figma-use export screenshot [--output viewport.png]
```

Export commands have built-in guards against oversized exports (max 4096px dimension, 16MP total). Override with `--force`:

```bash
figma-use export node <id> --scale 10 --force
```

Heavy operations support `--timeout` (seconds):
```bash
figma-use export node <id> --scale 2 --output large.png --timeout 300
```

### Selection & Navigation

```bash
figma-use selection get
figma-use selection set "1:2,1:3,1:4"

figma-use page list
figma-use page set <id|name>

figma-use viewport get
figma-use viewport set --x 100 --y 200 --zoom 0.5
figma-use viewport zoom-to-fit <ids...>
```

### Find & Query

```bash
figma-use find --name "Button"
figma-use find --name "Icon" --type FRAME
figma-use find --type INSTANCE --limit 50   # Limit results (default: 100)
figma-use get pages
figma-use get components --name "Button"    # Filter by name
figma-use get components --limit 50         # Limit results (default: 50)
figma-use get styles
```

### Boolean & Group

```bash
figma-use boolean union "1:2,1:3"
figma-use boolean subtract "1:2,1:3"
figma-use boolean intersect "1:2,1:3"
figma-use boolean exclude "1:2,1:3"

figma-use group create "1:2,1:3"
figma-use group ungroup <id>
figma-use group flatten "1:2,1:3"
```

### Render React Components

Render TSX/JSX components directly to Figma via WebSocket (bypasses plugin API for ~100x speed):

```bash
# From file
figma-use render ./Card.figma.tsx

# With props
figma-use render ./Card.figma.tsx --props '{"title": "Hello", "items": ["A", "B"]}'

# JSX snippet from stdin
echo '<Frame style={{width: 200, height: 100, backgroundColor: "#FF0000"}} />' | figma-use render --stdin

# Nested elements
echo '<Frame style={{padding: 20, gap: 10}}>
  <Text style={{fontSize: 24}}>Title</Text>
  <Rectangle style={{width: 100, height: 50, backgroundColor: "#3B82F6"}} />
</Frame>' | figma-use render --stdin

# Full component from stdin (with imports/exports)
cat component.tsx | figma-use render --stdin

# Into specific parent
figma-use render ./Card.figma.tsx --parent "1:23"

# Dry run (output NodeChanges JSON without sending)
figma-use render ./Card.figma.tsx --dryRun
```

**Important:** The `render` command requires:
1. Figma running with remote debugging: `figma --remote-debugging-port=9222`
2. Proxy server running: `figma-use proxy`

The proxy maintains persistent WebSocket connections for fast repeated renders:
- First render: ~4s (establishes connection)
- Subsequent renders: ~0.4s (reuses connection)

Example component (`Card.figma.tsx`):

```tsx
import * as React from 'react'
import { Frame, Text, Rectangle } from '@dannote/figma-use/components'

interface CardProps {
  title: string
  items: string[]
}

export default function Card({ title, items }: CardProps) {
  return (
    <Frame name="Card" style={{
      width: 300,
      flexDirection: 'column',
      padding: 24,
      gap: 16,
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
    }}>
      <Text name="Title" style={{ fontSize: 24, fontWeight: 'bold', color: '#000' }}>
        {title}
      </Text>
      <Frame name="Items" style={{ flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <Text key={i} style={{ fontSize: 16, color: '#666' }}>{item}</Text>
        ))}
      </Frame>
    </Frame>
  )
}
```

Available elements: `Frame`, `Rectangle`, `Ellipse`, `Text`, `Line`, `Star`, `Polygon`, `Vector`, `Component`, `Instance`, `Group`, `Page`, `View`

### Advanced

```bash
# Execute arbitrary JavaScript in Figma
figma-use eval "return figma.currentPage.name"
figma-use eval "const r = figma.createRectangle(); r.resize(100, 100); return r.id"
figma-use eval "await figma.loadFontAsync({family: 'Inter', style: 'Bold'})"

# Import SVG
figma-use import --svg "<svg>...</svg>" --x 0 --y 0
```

### Performance Profiling

Profile any command using Chrome DevTools Protocol:

```bash
# Start Figma with debug port
/Applications/Figma.app/Contents/MacOS/Figma --remote-debugging-port=9222

# Profile a command
figma-use profile "get components --limit 20"
figma-use profile "node tree --depth 2"
figma-use profile "find --type INSTANCE"
```

Output shows time breakdown (Figma WASM vs JS vs GC) and top functions by CPU time.

## Output Format

Human-readable by default:

```bash
$ figma-use create rect --x 0 --y 0 --width 100 --height 50 --fill "#FF0000"
✓ Created rect "Rectangle"
  id: 1:23
  box: 100x50 at (0, 0)
  fill: #FF0000

$ figma-use node children "1:2"
[0] frame "Header" (1:3)
    box: 1200x80 at (0, 0)
    fill: #FFFFFF

[1] text "Title" (1:4)
    box: 200x32 at (20, 24)
    font: 24px
```

Add `--json` for machine-readable output:

```bash
$ figma-use node get "1:2" --json
{
  "id": "1:2",
  "name": "Frame",
  "type": "FRAME",
  ...
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 38451 | Proxy server port |
| `FIGMA_PROXY_URL` | `http://localhost:38451` | Proxy URL for CLI |

## For AI Agents

figma-use is designed to work with AI coding agents like [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Cursor](https://cursor.sh), or any agent that can execute shell commands.

### Using with Claude Code

Copy the included skill to teach your agent how to use figma-use:

```bash
# From npm package
mkdir -p ~/.claude/skills/figma-use
cp node_modules/@dannote/figma-use/SKILL.md ~/.claude/skills/figma-use/

# Or download directly
curl -o ~/.claude/skills/figma-use/SKILL.md \
  https://raw.githubusercontent.com/dannote/figma-use/main/SKILL.md
```

Then just ask:

```
Create a card component with an avatar, title, and description in Figma
```

### Minimal Setup

For agents that don't support skills, add to your project's `CLAUDE.md` or `AGENTS.md`:

```markdown
## Figma Automation

Use `figma-use` for Figma control. Run `figma-use --help` for commands.

Workflow:
1. `figma-use status` - Check plugin connection
2. `figma-use create frame --x 0 --y 0 --width 400 --height 300 --fill "#FFF" --name "Card"`
3. `figma-use create text --x 20 --y 20 --text "Title" --fontSize 24 --fill "#000" --parent "1:2"`
4. `figma-use export screenshot --output preview.png` - Verify result
```

## License

MIT

### Variable Bindings (StyleX-inspired)

Bind Figma variables to colors in your components:

```tsx
// tokens.figma.ts
import { defineVars } from '@dannote/figma-use'

export const colors = defineVars({
  primary: 'VariableID:38448:122296',
  secondary: '38448:122301', // shorthand works too
})

// Card.figma.tsx
import { colors } from './tokens.figma'

export function Card({ title }: { title: string }) {
  return (
    <Frame style={{ backgroundColor: colors.primary }}>
      <Text style={{ color: colors.secondary }}>{title}</Text>
    </Frame>
  )
}
```

Variables are bound at the protocol level — no plugin API calls needed, instant updates.
