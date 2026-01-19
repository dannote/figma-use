# figma-use

CLI for Figma. Control it from the terminal — with commands or JSX.

```bash
echo '<Frame style={{p: 24, bg: "#3B82F6", rounded: 12}}>
  <Text style={{size: 18, color: "#FFF"}}>Hello Figma</Text>
</Frame>' | figma-use render --stdin
```

## Why

Figma's official MCP plugin can read files but can't modify them. This one can.

LLMs know CLI. LLMs know React. This combines both.

CLI commands are compact — easy to read, easy to generate, easy to chain. When a task involves dozens of operations, every saved token matters. MCP and JSON-RPC work too, but they add overhead.

JSX is how LLMs already think about UI. They've seen millions of React components. Describing a Figma layout as `<Frame><Text>` is natural for them — no special training, no verbose schemas.

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

## Installation

```bash
npm install -g @dannote/figma-use

figma-use plugin install  # Quit Figma first
figma-use proxy           # Start proxy server
```

Open Figma → Plugins → Development → **Figma Use**

## Two Modes

Imperative — one command at a time:

```bash
figma-use create frame --width 400 --height 300 --fill "#FFF" --radius 12 --layout VERTICAL --gap 16
```

Or declaratively — describe the structure in JSX and render it:

```bash
echo '<Frame style={{p: 24, gap: 16, flex: "col", bg: "#FFF", rounded: 12}}>
  <Text style={{size: 24, weight: "bold", color: "#000"}}>Card Title</Text>
  <Text style={{size: 14, color: "#666"}}>Description</Text>
</Frame>' | figma-use render --stdin
```

The stdin mode accepts pure JSX only — no variables, no logic. For components, variants, and conditions, use `.figma.tsx` files.

## Examples

### Icons

Insert any icon from Iconify by name. No downloading, no importing, no cleanup.

```bash
figma-use create icon mdi:home
figma-use create icon lucide:star --size 48 --color "#F59E0B"
```

In JSX:

```tsx
<Frame style={{ flex: "row", gap: 8 }}>
  <Icon icon="mdi:home" size={24} color="#3B82F6" />
  <Icon icon="lucide:star" size={32} color="#F59E0B" />
</Frame>
```

Browse 150k+ icons: [icon-sets.iconify.design](https://icon-sets.iconify.design/)

### Components

In a `.figma.tsx` file you can define components. First call creates the master, the rest create instances:

```tsx
import { defineComponent, Frame, Text } from '@dannote/figma-use/render'

const Card = defineComponent(
  'Card',
  <Frame style={{ p: 24, bg: '#FFF', rounded: 12 }}>
    <Text style={{ size: 18, color: '#000' }}>Card</Text>
  </Frame>
)

export default () => (
  <Frame style={{ gap: 16, flex: 'row' }}>
    <Card />
    <Card />
    <Card />
  </Frame>
)
```

### Variants

ComponentSet with all combinations:

```tsx
import { defineComponentSet, Frame, Text } from '@dannote/figma-use/render'

const Button = defineComponentSet(
  'Button',
  {
    variant: ['Primary', 'Secondary'] as const,
    size: ['Small', 'Large'] as const,
  },
  ({ variant, size }) => (
    <Frame
      style={{
        p: size === 'Large' ? 16 : 8,
        bg: variant === 'Primary' ? '#3B82F6' : '#E5E7EB',
        rounded: 8,
      }}
    >
      <Text style={{ color: variant === 'Primary' ? '#FFF' : '#111' }}>
        {variant} {size}
      </Text>
    </Frame>
  )
)

export default () => (
  <Frame style={{ gap: 16, flex: 'col' }}>
    <Button variant="Primary" size="Large" />
    <Button variant="Secondary" size="Small" />
  </Frame>
)
```

This creates a real ComponentSet in Figma with all 4 variants, not just 4 separate buttons.

### Variables as Tokens

Bind colors to Figma variables by name. The hex value is a fallback:

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

In CLI, use `var:Colors/Primary` or `$Colors/Primary` in any color option.

### Diffs

Compare two frames and get a patch:

```bash
figma-use diff create --from 123:456 --to 789:012
```

```diff
--- /Card/Header #123:457
+++ /Card/Header #789:013
@@ -1,5 +1,5 @@
 type: FRAME
 size: 200 50
 pos: 0 0
-fill: #FFFFFF
+fill: #F0F0F0
-opacity: 0.8
+opacity: 1
```

Apply the patch to the original frame. On apply, current state is validated against expected — if they don't match, it fails. There's also visual diff: overlay two PNGs and highlight differences.

### Inspection

Page tree in readable form:

```
$ figma-use node tree
[0] frame "Card" (1:23)
    400×300 at (0, 0) | fill: #FFFFFF | layout: col gap=16
  [0] text "Title" (1:24)
      "Hello World" | 24px Inter Bold
```

Export any node or screenshot with one command.

### Vectors

Import SVG or work with paths directly — read, modify, translate, scale, flip:

```bash
figma-use path get <id>
figma-use path set <id> "M 0 0 L 100 100 Z"
figma-use path scale <id> --factor 1.5
figma-use path flip <id> --axis x
```

## Render via Multiplayer Protocol

The `render` command uses Figma's internal multiplayer protocol, not just Plugin API. It's faster, but the protocol is internal and may change. Good for generation and prototyping.

## Full Command Reference

See [REFERENCE.md](./REFERENCE.md) for the complete list of 100+ commands.

## For AI Agents

Includes [SKILL.md](./SKILL.md) — a reference for Claude Code, Cursor, and other agents.

```bash
mkdir -p ~/.claude/skills/figma-use
curl -o ~/.claude/skills/figma-use/SKILL.md \
  https://raw.githubusercontent.com/dannote/figma-use/master/SKILL.md
```

## MCP Server

The proxy exposes an MCP endpoint at `http://localhost:38451/mcp`. Run `figma-use mcp` for config.

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Terminal  │────▶│  figma-use  │────▶│   Plugin    │
│             │ CLI │    proxy    │ WS  │             │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    MCP ───┤ WebSocket (multiplayer)
                           ▼
                    ┌─────────────┐
                    │   Figma     │
                    └─────────────┘
```

## License

MIT
