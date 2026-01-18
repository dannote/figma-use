---
name: figma-use
description: Control Figma via CLI — create shapes, frames, text, components, set styles, layout, variables, export images. Use when asked to create/modify Figma designs or automate design tasks.
---

# Figma Use

Full control over Figma from the command line.

## Setup

```bash
bun install -g @dannote/figma-use
figma-use plugin     # Install plugin (quit Figma first!)
figma-use proxy      # Start proxy server
# Open Figma → Plugins → Development → Figma Use
```

## Quick Reference

### Create Shapes

```bash
figma-use create rect --x 0 --y 0 --width 100 --height 50 --fill "#FF0000" --radius 8
figma-use create ellipse --x 0 --y 0 --width 80 --height 80 --fill "#00FF00"
figma-use create line --x 0 --y 0 --length 100 --stroke "#000"
figma-use create polygon --x 0 --y 0 --size 60 --sides 6 --fill "#F59E0B"
figma-use create star --x 0 --y 0 --size 60 --points 5 --fill "#EF4444"
```

### Create Frames (with auto-layout)

```bash
figma-use create frame --x 0 --y 0 --width 400 --height 300 \
  --fill "#FFF" --radius 12 --name "Card" \
  --layout VERTICAL --gap 16 --padding "24,24,24,24"

figma-use create frame --x 0 --y 0 --width 200 --height 48 \
  --fill "#3B82F6" --radius 8 --name "Button" \
  --layout HORIZONTAL --gap 8 --padding "12,24,12,24"
```

### Create Text

```bash
figma-use create text --x 0 --y 0 --text "Hello" \
  --fontSize 24 --fontFamily "Inter" --fontStyle "Bold" --fill "#000"
```

### Node Operations

```bash
figma-use node get <id>                      # Get properties
figma-use node tree [id]                     # Get formatted tree (see structure at a glance)
figma-use node tree --depth 2                # Limit tree depth (also limits node count)
figma-use node tree -i                       # Only interactive elements
figma-use node tree --force                  # Skip 500 node limit
figma-use node children <id>                 # List children
figma-use node move <id> --x 100 --y 200
figma-use node resize <id> --width 300 --height 200
figma-use node rename <id> "New Name"
figma-use node clone <id>
figma-use node delete <id>
```

`tree` output example:
```
[0] frame "Card" (1:23)
    400×300 at (0, 0) | fill: #FFFFFF | layout: col gap=16
  [0] text "Title" (1:24)
      200×32 at (24, 24) | "Hello World" | font: 24px Inter
```

### Set Properties

```bash
figma-use set fill <id> "#FF0000"
figma-use set stroke <id> "#000" --weight 2
figma-use set radius <id> --radius 12
figma-use set radius <id> --topLeft 16 --bottomRight 16
figma-use set opacity <id> 0.8
figma-use set rotation <id> 45
figma-use set text <id> "Updated text"
figma-use set font <id> --family "Inter" --style "Bold" --size 20
figma-use set layout <id> --mode HORIZONTAL --gap 8 --padding 16
figma-use set effect <id> --type DROP_SHADOW --radius 10 --offsetY 4 --color "#00000040"
```

### Variables (Design Tokens)

```bash
figma-use collection list
figma-use collection create "Colors"

figma-use variable list --type COLOR
figma-use variable create "Primary" --collection <collectionId> --type COLOR --value "#3B82F6"
figma-use variable set <varId> --mode <modeId> --value "#1D4ED8"
figma-use variable bind --node <nodeId> --field fills --variable <varId>
```

### Styles

```bash
figma-use style list
figma-use style create-paint "Brand/Primary" --color "#E11D48"
figma-use style create-text "Heading/H1" --family "Inter" --style "Bold" --size 32
```

### Export

```bash
figma-use export node <id> --format PNG --scale 2 --output design.png
figma-use export screenshot --output viewport.png
figma-use export selection --output selection.png
```

Heavy ops support `--timeout` (seconds):
```bash
figma-use export node <id> --timeout 300
```

### Selection & Navigation

```bash
figma-use selection get
figma-use selection set "1:2,1:3"
figma-use page list
figma-use page set "Page Name"
figma-use viewport zoom-to-fit <ids...>
```

### Find

```bash
figma-use find --name "Button"
figma-use find --type FRAME
figma-use find --type INSTANCE              # All instances on page
figma-use get components --name "Button"    # Filter components by name
figma-use get components --limit 50         # Limit results
```

### Boolean & Group

```bash
figma-use boolean union "1:2,1:3"
figma-use boolean subtract "1:2,1:3"
figma-use group create "1:2,1:3"
figma-use group ungroup <id>
```

### Render React Components (Experimental)

> ⚠️ Uses Figma's internal multiplayer protocol — may break without notice.

Render TSX/JSX directly to Figma (~100x faster than plugin API):

```bash
# From file
figma-use render ./Card.figma.tsx

# JSX snippet from stdin
echo '<Frame style={{width: 200, height: 100, backgroundColor: "#FF0000"}} />' | figma-use render --stdin

# Nested elements
echo '<Frame style={{padding: 20, gap: 10, flexDirection: "column"}}>
  <Text style={{fontSize: 24, color: "#000"}}>Title</Text>
  <Rectangle style={{width: 100, height: 50, backgroundColor: "#3B82F6"}} />
</Frame>' | figma-use render --stdin

# With props
figma-use render ./Card.figma.tsx --props '{"title": "Hello"}'

# Into specific parent
figma-use render ./Card.figma.tsx --parent "1:23"
```

**Requires:**
1. Figma with `figma --remote-debugging-port=9222`
2. Proxy running: `figma-use proxy`

Available elements: `Frame`, `Rectangle`, `Ellipse`, `Text`, `Line`, `Star`, `Polygon`, `Vector`, `Component`, `Instance`, `Group`

#### Variable Bindings (Experimental)

Bind Figma variables to colors by name with fallback values:

```tsx
import { defineVars, Frame } from '@dannote/figma-use'

const colors = defineVars({
  primary: { name: 'Colors/Gray/50', value: '#F8FAFC' },
  border: { name: 'Colors/Gray/500', value: '#64748B' },
})

export default () => (
  <Frame style={{ backgroundColor: colors.primary, borderColor: colors.border }} />
)
```

Supports: `backgroundColor`, `borderColor`, text `color`.

### Eval (Arbitrary Code)

```bash
figma-use eval "return figma.currentPage.name"
figma-use eval "const r = figma.createRectangle(); r.resize(100, 100); return r.id"
```

## Output

Human-readable by default. Add `--json` for machine parsing:
```bash
figma-use node get <id> --json
```

## Colors

Hex format: `#RGB`, `#RRGGBB`, or `#RRGGBBAA`

## Node IDs

Format: `pageIndex:nodeIndex` (e.g., `1:2`, `45:123`)

Get IDs from:
- `figma-use selection get`
- `figma-use node children <parentId>`
- Figma → right-click → Copy link → ID in URL
