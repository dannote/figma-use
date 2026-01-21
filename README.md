# figma-use

CLI for Figma. Control it from the terminal — with commands or JSX.

```bash
# Create and style
figma-use create frame --width 400 --height 300 --fill "#FFF" --layout VERTICAL --gap 16
figma-use create icon mdi:home --size 32 --color "#3B82F6"
figma-use set layout 1:23 --mode GRID --cols "1fr 1fr 1fr" --gap 16

# Or render JSX
echo '<Frame style={{display: "grid", cols: "1fr 1fr", gap: 16}}>
  <Frame style={{bg: "#3B82F6", h: 100}} />
  <Frame style={{bg: "#10B981", h: 100}} />
</Frame>' | figma-use render --stdin --x 100 --y 100
```

## Why

Figma's official MCP plugin can read files but can't modify them. This one can.

LLMs know CLI. LLMs know React. This combines both.

CLI commands are compact — easy to read, easy to generate, easy to chain. When a task involves dozens of operations, every saved token matters.

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
npm install -g figma-use
```

Or run directly without installing:

```bash
npx figma-use status
```

Start Figma with remote debugging enabled:

```bash
# macOS
open -a Figma --args --remote-debugging-port=9222

# Windows
"C:\Users\%USERNAME%\AppData\Local\Figma\Figma.exe" --remote-debugging-port=9222

# Linux
figma --remote-debugging-port=9222
```

Check connection:

```bash
figma-use status
```

That's it. No plugins to install.

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
</Frame>' | figma-use render --stdin --x 100 --y 200
```

The stdin mode accepts pure JSX only — no variables, no logic. For components, variants, and conditions, use `.figma.tsx` files.

**Elements:** `Frame`, `Rectangle`, `Ellipse`, `Text`, `Line`, `Star`, `Polygon`, `Vector`, `Group`, `Icon`, `Image`

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

### Images

Load images from URL:

```tsx
<Image src="https://example.com/photo.jpg" w={200} h={150} />
```

### Components

In a `.figma.tsx` file you can define components. First call creates the master, the rest create instances:

```tsx
import { defineComponent, Frame, Text } from 'figma-use/render'

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
import { defineComponentSet, Frame, Text } from 'figma-use/render'

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

### Grid Layout

CSS Grid for 2D layouts — calendars, dashboards, galleries:

```tsx
<Frame
  style={{
    display: 'grid',
    cols: '1fr 1fr 1fr',  // 3 equal columns
    rows: 'auto auto',    // 2 rows
    gap: 16
  }}
>
  <Frame style={{ bg: '#FF6B6B' }} />
  <Frame style={{ bg: '#4ECDC4' }} />
  <Frame style={{ bg: '#45B7D1' }} />
  <Frame style={{ bg: '#96CEB4' }} />
  <Frame style={{ bg: '#FFEAA7' }} />
  <Frame style={{ bg: '#DDA0DD' }} />
</Frame>
```

Supports `px`, `fr`, and `auto`/`hug`. Separate gaps with `colGap` and `rowGap`.

In CLI:

```bash
figma-use set layout <id> --mode GRID --cols "100px 1fr 100px" --rows "auto" --gap 16
```

### Variables as Tokens

Bind colors to Figma variables by name. The hex value is a fallback:

```tsx
import { defineVars, Frame, Text } from 'figma-use/render'

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

Apply the patch to the original frame. On apply, current state is validated against expected — if they don't match, it fails.

Visual diff highlights changed pixels in red:

```bash
figma-use diff visual --from 49:275096 --to 49:280802 --output diff.png
```

| Before | After | Diff |
|--------|-------|------|
| ![before](assets/diff-before.png) | ![after](assets/diff-after.png) | ![diff](assets/diff-result.png) |

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

### Query

Find nodes using XPath selectors:

```bash
figma-use query "//FRAME"                              # All frames
figma-use query "//FRAME[@width < 300]"                # Narrower than 300px
figma-use query "//COMPONENT[starts-with(@name, 'Button')]"  # Name starts with
figma-use query "//FRAME[contains(@name, 'Card')]"     # Name contains
figma-use query "//SECTION/FRAME"                      # Direct children
figma-use query "//SECTION//TEXT"                      # All descendants
figma-use query "//*[@cornerRadius > 0]"               # Any node with radius
```

Full XPath 3.1 support — predicates, functions, arithmetic, axes.

## Full Command Reference

See [REFERENCE.md](./REFERENCE.md) for the complete list of 100+ commands.

## MCP Server

For AI agents that support Model Context Protocol:

```bash
figma-use mcp serve
```

Exposes 90+ tools. See [MCP.md](./MCP.md) for setup.

## For AI Agents

Includes [SKILL.md](./SKILL.md) — a reference for Claude Code, Cursor, and other agents.

## How It Works

```
┌─────────────┐            ┌─────────────┐
│   Terminal  │────CDP────▶│   Figma     │
│  figma-use  │  port 9222 │             │
└─────────────┘            └─────────────┘
```

figma-use communicates directly with Figma via Chrome DevTools Protocol (CDP). Just start Figma with `--remote-debugging-port=9222` and you're ready.

Commands are executed via `Runtime.evaluate` in Figma's JavaScript context, with full access to the Plugin API.

## License

MIT
