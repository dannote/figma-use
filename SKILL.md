---
name: figma-use
description: Control Figma via CLI — create shapes, frames, text, components, set styles, layout, variables, export images. Use when asked to create/modify Figma designs or automate design tasks.
---

# figma-use

CLI for Figma. Two modes: commands and JSX.

```bash
# Commands
figma-use create frame --width 400 --height 300 --fill "#FFF" --layout VERTICAL --gap 16
figma-use create icon mdi:home --size 32 --color "#3B82F6"
figma-use set fill 1:23 "$Colors/Primary"

# JSX
echo '<Frame style={{p: 24, bg: "#3B82F6", rounded: 12}}>
  <Text style={{size: 18, color: "#FFF"}}>Hello</Text>
</Frame>' | figma-use render --stdin --x 100 --y 100
```

## Before You Start

```bash
figma-use status  # Check connection
```

If not connected:
```bash
figma-use plugin install                 # Install plugin (quit Figma first)
figma-use proxy &                        # Start proxy
figma --remote-debugging-port=9222       # Start Figma with debug port
# In Figma: Plugins → Development → Figma Use
```

## Two Modes

**Imperative** — single operations:
```bash
figma-use create frame --width 400 --height 300 --fill "#FFF" --radius 12
figma-use set fill <id> "#FF0000"
figma-use node move <id> --x 100 --y 200
```

**Declarative** — render JSX trees:
```bash
echo '<Frame style={{p: 24, gap: 16, flex: "col", bg: "#FFF", rounded: 12}}>
  <Text style={{size: 24, weight: "bold", color: "#000"}}>Title</Text>
  <Text style={{size: 14, color: "#666"}}>Description</Text>
</Frame>' | figma-use render --stdin --x 100 --y 200
```

⚠️ **stdin = pure JSX only.** No variables, no logic, no imports. For components/variants use `.figma.tsx` files.

**Elements:** `Frame`, `Rectangle`, `Ellipse`, `Text`, `Line`, `Star`, `Polygon`, `Vector`, `Group`, `Icon`

⚠️ **Always use `--x` and `--y`** to position renders. Don't stack everything at (0, 0).

## Icons

150k+ icons from Iconify by name:

```bash
figma-use create icon mdi:home
figma-use create icon lucide:star --size 48 --color "#F59E0B"
figma-use create icon heroicons:bell-solid --component  # as Figma component
```

In JSX:
```tsx
<Icon icon="mdi:home" size={24} color="#3B82F6" />
```

## Variables as Tokens

Reference Figma variables in any color option with `var:Name` or `$Name`:

```bash
figma-use create rect --width 100 --height 100 --fill 'var:Colors/Primary'
figma-use set fill <id> '$Brand/Accent'
```

## Style Shorthands

| Short | Full | Values |
|-------|------|--------|
| `w`, `h` | width, height | number |
| `bg` | backgroundColor | hex |
| `rounded` | borderRadius | number |
| `p`, `px`, `py` | padding | number |
| `flex` | flexDirection | `"row"`, `"col"` |
| `justify` | justifyContent | `"start"`, `"center"`, `"end"`, `"between"` |
| `items` | alignItems | `"start"`, `"center"`, `"end"`, `"stretch"` |
| `size` | fontSize | number |
| `weight` | fontWeight | `"bold"`, number |
| `font` | fontFamily | string |
| `pt`, `pr`, `pb`, `pl` | padding sides | number |

Also: `gap`, `opacity`, `color`, `borderColor`, `borderWidth`, `textAlign`, `x`, `y`

## Components (via .figma.tsx)

First call creates master, rest create instances:

```tsx
import { defineComponent, Frame, Text } from '@dannote/figma-use/render'

const Card = defineComponent('Card',
  <Frame style={{ p: 24, bg: '#FFF', rounded: 12 }}>
    <Text style={{ size: 18, color: '#000' }}>Card</Text>
  </Frame>
)

export default () => (
  <Frame style={{ gap: 16, flex: 'row' }}>
    <Card />
    <Card />
  </Frame>
)
```

```bash
figma-use render ./Card.figma.tsx --x 100 --y 200
figma-use render --examples  # Full API reference
```

## Variants (ComponentSet)

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
```

Creates real ComponentSet with all combinations.

## Diffs

Compare frames and generate patch:

```bash
figma-use diff create --from <id1> --to <id2>
```

```diff
--- /Card/Header #123:457
+++ /Card/Header #789:013
 type: FRAME
 size: 200 50
-fill: #FFFFFF
+fill: #F0F0F0
```

⚠️ Context lines need space prefix: ` size: 200 50` not `size: 200 50`

Apply with validation:
```bash
figma-use diff apply patch.diff            # Fails if old values don't match
figma-use diff apply patch.diff --dry-run  # Preview
figma-use diff apply patch.diff --force    # Skip validation
```

Visual diff (red = changed pixels):
```bash
figma-use diff visual --from <id1> --to <id2> --output diff.png
```

⚠️ **After initial render, use diffs or direct commands.** Don't re-render full JSX trees.

## Query (XPath)

Find nodes using XPath selectors:

```bash
figma-use query "//FRAME"                              # All frames
figma-use query "//FRAME[@width < 300]"                # Frames narrower than 300px
figma-use query "//COMPONENT[starts-with(@name, 'Button')]"  # Name starts with
figma-use query "//FRAME[contains(@name, 'Card')]"     # Name contains
figma-use query "//SECTION/FRAME"                      # Direct children
figma-use query "//SECTION//TEXT"                      # All descendants
figma-use query "//*[@cornerRadius > 0]"               # Any node with radius
figma-use query "//FRAME[@width > 100 and @width < 500]"  # Range
```

Attributes: `name`, `width`, `height`, `x`, `y`, `cornerRadius`, `opacity`, `visible`, `characters`, `fontSize`, `layoutMode`, `itemSpacing`

XPath functions: `contains()`, `starts-with()`, `string-length()`, `not()`, `and`, `or`

## Common Commands

```bash
# Create
figma-use create frame --width 400 --height 300 --fill "#FFF" --layout VERTICAL --gap 16
figma-use create text --text "Hello" --font-size 24 --fill "#000"
figma-use create rect --width 100 --height 50 --fill "#F00" --radius 8

# Find
figma-use query "//FRAME[@name = 'Header']"
figma-use find --name "Button"
figma-use find --type FRAME
figma-use selection get

# Modify
figma-use set fill <id> "#FF0000"
figma-use set radius <id> 12
figma-use set text <id> "New text"
figma-use set layout <id> --mode VERTICAL --gap 12 --padding 16
figma-use node move <id> --x 100 --y 200
figma-use node resize <id> --width 300 --height 200
figma-use node delete <id>
figma-use node to-component <id>

# Export
figma-use export node <id> --output design.png
figma-use export screenshot --output viewport.png

# Navigate
figma-use page list
figma-use page set "Page Name"
figma-use viewport zoom-to-fit <id>
```

Full reference: [REFERENCE.md](https://github.com/dannote/figma-use/blob/master/REFERENCE.md)

## Output

Human-readable by default. Add `--json` for machine parsing.

## Node IDs

Format: `session:local` (e.g., `1:23`). Inside instances: `I<instance-id>;<internal-id>`.

Get IDs from `figma-use selection get` or `figma-use node tree`.

## Colors

Hex: `#RGB`, `#RRGGBB`, `#RRGGBBAA`
Variables: `var:Colors/Primary` or `$Colors/Primary`

---

## Best Practices

### Always verify visually
```bash
figma-use export node <id> --output /tmp/check.png
```

### Always zoom after creating
```bash
figma-use viewport zoom-to-fit <id>
```

### Position multiple renders separately
```bash
echo '...' | figma-use render --stdin --x 0 --y 0
echo '...' | figma-use render --stdin --x 500 --y 0    # Not at same position!
```

### Copy between pages
```bash
figma-use node clone <id> --json | jq -r '.id'
figma-use node set-parent <new-id> --parent <target-page-id>
figma-use node move <new-id> --x 50 --y 50
```

### Convert to component
```bash
figma-use node to-component <id>
figma-use node to-component "1:2 1:3 1:4"  # Multiple
```

### Instance internal IDs
```bash
figma-use set text "I123:456;789:10" "New text"  # I<instance>;<internal>
```

### Row layout needs width
```bash
# ❌ Collapses to 1×1
<Frame style={{flex: "row", gap: 8}}>

# ✅ Explicit width
<Frame style={{w: 300, flex: "row", gap: 8}}>
```

### Sections
```bash
figma-use create section --name "Buttons" --x 0 --y 0 --width 600 --height 200
figma-use node set-parent <id> --parent <section-id>
```
⚠️ Deleting section deletes all children!

### Vector paths — iterative workflow

Draw, screenshot, adjust, repeat — like a designer tweaking Bezier curves:

```bash
# 1. Draw initial shape
figma-use create vector --path "M 50 0 L 100 100 L 0 100 Z" --fill "#F00"

# 2. Check result
figma-use export node <id> --output /tmp/shape.png

# 3. Adjust: scale, move, flip
figma-use path scale <id> --factor 0.8
figma-use path move <id> --dx 20 --dy -10
figma-use path flip <id> --axis x

# 4. Or replace path entirely
figma-use path set <id> "M 50 0 C 80 30 80 70 50 100 C 20 70 20 30 50 0 Z"

# 5. Screenshot again, repeat until good
figma-use export node <id> --output /tmp/shape.png
```

For complex illustrations, import SVG:
```bash
figma-use import --svg "$(cat icon.svg)"
```
