# figma-use

**CLI for Figma.** LLMs already know React and work great with CLIs — this combines both.

```bash
echo '<Frame style={{p: 24, bg: "#3B82F6", rounded: 12}}>
  <Text style={{size: 18, color: "#FFF"}}>Hello Figma</Text>
</Frame>' | figma-use render --stdin
```

No JSON schemas, no MCP protocol overhead — just JSX that any LLM can write.

📄 **Includes [SKILL.md](./SKILL.md)** — drop-in reference for Claude Code and other AI agents.

## Demo

<table>
<tr>
<td width="50%">
<a href="https://youtu.be/9eSYVZRle7o">
<img src="https://img.youtube.com/vi/9eSYVZRle7o/maxresdefault.jpg" alt="Button components demo" width="100%">
</a>
<p align="center"><b>▶️ Button components</b></p>
</td>
<td width="50%">
<a href="https://youtu.be/efJWp2Drzb4">
<img src="https://img.youtube.com/vi/efJWp2Drzb4/maxresdefault.jpg" alt="Calendar demo" width="100%">
</a>
<p align="center"><b>▶️ Tailwind UI calendar</b></p>
</td>
</tr>
</table>

## Why CLI over MCP?

MCP servers exchange verbose JSON. CLIs are **token-efficient**:

```bash
# 47 tokens
figma-use create frame --width 400 --height 300 --fill "#FFF" --radius 12 --layout VERTICAL --gap 16
```

vs MCP JSON request + response: **~200 tokens** for the same operation.

For AI agents doing dozens of Figma operations, this adds up fast. If you still prefer MCP, see [MCP Server](#mcp-server) section.

## Why JSX?

Every LLM has been trained on millions of React components. They can write this without examples:

```tsx
<Frame style={{ flex: 'col', gap: 16, p: 24 }}>
  <Text style={{ size: 24, weight: 'bold' }}>Title</Text>
  <Text style={{ size: 14, color: '#666' }}>Description</Text>
</Frame>
```

The `render` command takes this JSX and creates real Figma nodes — frames, text, components, auto-layout, the works.

## Installation

```bash
bun install -g @dannote/figma-use

figma-use plugin install  # Install plugin (quit Figma first)
figma-use proxy      # Start proxy server
```

Open Figma → Plugins → Development → **Figma Use**

## Render: JSX → Figma (Experimental)

> ⚠️ Uses Figma's internal multiplayer protocol — ~100x faster than plugin API, but may break if Figma changes it.

### Setup

```bash
# Terminal 1: Start Figma with debug port
figma --remote-debugging-port=9222

# Terminal 2: Start proxy
figma-use proxy
```

### Basic Usage

```bash
# From stdin
echo '<Frame style={{w: 200, h: 100, bg: "#FF0000"}} />' | figma-use render --stdin

# From file
figma-use render ./Card.figma.tsx

# With props
figma-use render ./Card.figma.tsx --props '{"title": "Hello"}'
```

### Supported Elements

`Frame`, `Rectangle`, `Ellipse`, `Text`, `Line`, `Star`, `Polygon`, `Vector`, `Group`

### Style Properties (with Tailwind-like shorthands)

```tsx
// Layout
flex: 'row' | 'col'                    // flexDirection
justify: 'start' | 'center' | 'end' | 'between' | 'evenly'  // justifyContent
items: 'start' | 'center' | 'end' | 'stretch'  // alignItems
gap: number
p: number                              // padding
pt / pr / pb / pl: number              // paddingTop/Right/Bottom/Left
px / py: number                        // horizontal / vertical padding

// Size & Position
w: number                              // width
h: number                              // height
x: number
y: number

// Appearance
bg: string                             // backgroundColor (hex)
borderColor: string
borderWidth: number
rounded: number                        // borderRadius
opacity: number

// Text
size: number                           // fontSize
font: string                           // fontFamily
weight: 'normal' | 'bold' | number     // fontWeight
color: string
textAlign: 'left' | 'center' | 'right'
```

Full property names (`width`, `backgroundColor`, etc.) also work.

### Reusable Components

`defineComponent` creates a Figma Component. First usage renders the master, subsequent usages create Instances:

```tsx
import { defineComponent, Frame, Text } from '@dannote/figma-use/render'

const Card = defineComponent('Card',
  <Frame style={{ p: 24, bg: '#FFF', rounded: 12 }}>
    <Text style={{ size: 18, color: '#000' }}>Card</Text>
  </Frame>
)

export default () => (
  <Frame style={{ gap: 16, flex: 'row' }}>
    <Card />  {/* Creates Component */}
    <Card />  {/* Creates Instance */}
    <Card />  {/* Creates Instance */}
  </Frame>
)
```

### Component Variants

`defineComponentSet` creates a Figma ComponentSet with all variant combinations:

```tsx
import { defineComponentSet, Frame, Text } from '@dannote/figma-use/render'

const Button = defineComponentSet('Button', {
  variant: ['Primary', 'Secondary'] as const,
  size: ['Small', 'Large'] as const,
}, ({ variant, size }) => (
  <Frame style={{ 
    p: size === 'Large' ? 16 : 8,
    bg: variant === 'Primary' ? '#3B82F6' : '#E5E7EB',
    rounded: 8,
  }}>
    <Text style={{ color: variant === 'Primary' ? '#FFF' : '#111' }}>
      {variant} {size}
    </Text>
  </Frame>
))

export default () => (
  <Frame style={{ gap: 16, flex: 'col' }}>
    <Button variant="Primary" size="Large" />
    <Button variant="Secondary" size="Small" />
  </Frame>
)
```

This creates 4 variant components (Primary/Small, Primary/Large, Secondary/Small, Secondary/Large) inside a ComponentSet, plus instances with the requested variants.

### Variable Bindings

Bind colors to Figma variables by name:

```tsx
import { defineVars, Frame, Text } from '@dannote/figma-use/render'

const colors = defineVars({
  bg: { name: 'Colors/Gray/50', value: '#F8FAFC' },
  text: { name: 'Colors/Gray/900', value: '#0F172A' },
})

export default () => (
  <Frame style={{ bg: colors.bg }}>
    <Text style={{ color: colors.text }}>Bound to variables</Text>
  </Frame>
)
```

The `value` is a fallback. At render time, colors get bound to actual Figma variables by name.

---

## CLI Commands

The `render` command is the fastest way to create complex layouts. For simpler operations or modifications, use direct commands:

### Create

```bash
figma-use create frame --width 400 --height 300 --fill "#FFF" --radius 12 --layout VERTICAL --gap 16
figma-use create rect --width 100 --height 50 --fill "#FF0000" --radius 8
figma-use create ellipse --width 80 --height 80 --fill "#00FF00"
figma-use create text --text "Hello" --font-size 24 --fill "#000"
figma-use create line --length 100 --stroke "#000"
figma-use create component --width 200 --height 100
figma-use create instance --component <id>
```

### Icons (Iconify)

150k+ icons from 100+ sets (mdi, lucide, heroicons, tabler, fa, phosphor, etc.):

```bash
figma-use create icon mdi:home
figma-use create icon lucide:star --size 48 --color "#FFD700"
figma-use create icon heroicons:bell-solid --component  # as Figma component
```

Browse icons: https://icon-sets.iconify.design/

### Variables in Colors

Use `var:Name` or `$Name` to reference Figma variables:

```bash
figma-use create rect --x 0 --y 0 --width 100 --height 100 --fill 'var:Colors/Primary'
figma-use create frame --width 200 --height 100 --fill '$Brand/Background'
figma-use create icon mdi:home --color 'var:Icon/Default'
```

### Modify

```bash
figma-use set fill <id> "#FF0000"
figma-use set stroke <id> "#000" --weight 2
figma-use set radius <id> 12
figma-use set opacity <id> 0.5
figma-use set text <id> "New text"
figma-use set font <id> --family "Inter" --style "Bold" --size 20
figma-use set layout <id> --mode VERTICAL --gap 12 --padding 16
figma-use set effect <id> --type DROP_SHADOW --radius 10 --color "#00000040"
```

### Query

```bash
figma-use node get <id>              # Get node properties
figma-use node tree                  # Page structure as readable tree
figma-use node children <id>         # List children
figma-use node bounds <id>           # Position, size, center point
figma-use find --name "Button"       # Find by name
figma-use find --type FRAME          # Find by type
figma-use selection get              # Current selection
```

### Vector Paths

```bash
figma-use create vector --x 0 --y 0 --path "M 0 0 L 100 50 L 0 100 Z" --fill "#F00"
figma-use path get <id>              # Read path data
figma-use path set <id> "M 0 0 ..."  # Replace path
figma-use path move <id> --dx 10 --dy -5   # Translate points
figma-use path scale <id> --factor 1.5     # Scale from center
figma-use path flip <id> --axis x          # Mirror horizontally
```

### Export

```bash
figma-use export node <id> --output design.png
figma-use export screenshot --output viewport.png
figma-use export selection --output selection.png
```

### Navigate

```bash
figma-use page list
figma-use page set "Page Name"
figma-use viewport zoom-to-fit <ids...>
```

### Variables & Styles

```bash
figma-use variable list
figma-use variable create "Primary" --collection <id> --type COLOR --value "#3B82F6"
figma-use style list
figma-use style create-paint "Brand/Primary" --color "#E11D48"
```

### Fonts

```bash
figma-use font list                  # All available fonts
figma-use font list --family Roboto  # Filter by family name
```

### Comments & History

```bash
figma-use comment list                       # List file comments
figma-use comment add "Review this"          # Add comment
figma-use comment add "Here" --x 200 --y 100 # Comment at position
figma-use comment delete <id>                # Delete comment
figma-use version list                       # Version history
figma-use me                                 # Current user info
figma-use file info                          # File key and name
```

### Diff (Experimental)

Compare two frames and generate a unified diff patch:

```bash
# Compare original vs modified version
figma-use diff create --from 123:456 --to 789:012
```

Apply patch with validation (fails if current state doesn't match expected):

```bash
figma-use diff apply patch.diff           # Apply from file
figma-use diff apply --stdin < patch.diff # Apply from stdin
figma-use diff apply patch.diff --dry-run # Preview changes
figma-use diff apply patch.diff --force   # Skip validation
```

### Escape Hatch

```bash
figma-use eval "return figma.currentPage.name"
figma-use eval "figma.createRectangle().resize(100, 100)"
```

---

## Output

Human-readable by default:

```
$ figma-use node tree
[0] frame "Card" (1:23)
    400×300 at (0, 0) | fill: #FFFFFF | layout: col gap=16
  [0] text "Title" (1:24)
      "Hello World" | 24px Inter Bold
```

Add `--json` for machine parsing:

```bash
figma-use node get <id> --json
```

## For AI Agents

**Includes ready-to-use [SKILL.md](./SKILL.md)** — a comprehensive reference that teaches AI agents all commands and patterns. Works with Claude Code, Cursor, and any agent that supports skill files.

```bash
# Claude Code / pi
mkdir -p ~/.claude/skills/figma-use
cp node_modules/@dannote/figma-use/SKILL.md ~/.claude/skills/figma-use/

# Or download directly  
curl -o ~/.claude/skills/figma-use/SKILL.md \
  https://raw.githubusercontent.com/anthropics/figma-use/main/SKILL.md
```

For simpler setups, add to your project's `AGENTS.md`:

```markdown
## Figma

Use `figma-use` CLI. For complex layouts, use `figma-use render --stdin` with JSX.
Run `figma-use --help` for all commands.
```

## MCP Server

If your client only supports MCP, the proxy exposes an endpoint at `http://localhost:38451/mcp` with 80+ auto-generated tools. Run `figma-use mcp` for config snippet.

---

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  AI Agent   │────▶│  figma-use  │────▶│   Plugin    │
│             │ CLI │    proxy    │ WS  │             │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    MCP ───┤ WebSocket (multiplayer)
                           ▼
                    ┌─────────────┐
                    │   Figma     │
                    │   Server    │
                    └─────────────┘
```

- **CLI commands** → Plugin API (full Figma access)
- **MCP endpoint** → Same as CLI, JSON-RPC protocol
- **render command** → Multiplayer protocol (~100x faster, experimental)

## License

MIT
